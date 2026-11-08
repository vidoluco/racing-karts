// The certificate of the https address that tilt steering needs: a phone gives its motion sensors only to a secure page.
// Self-signed and made here with the system's openssl on first run, no npm package, kept in a gitignored folder. Its names
// are the Mac's addresses: a new one is made when the address phones would use is not among them, and it keeps the older
// addresses too, so that going home to the same Wi-Fi does not bring back a warning a phone has already passed.
import { execFile } from 'node:child_process';
import { X509Certificate, createPrivateKey } from 'node:crypto';
import { chmod, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const CERT_FILE = 'pad.pem';
const OPENSSL = ['/usr/bin/openssl', 'openssl'];
const MARGIN_MS = 30 * 86400000; // this close to its end it is made again, not in the middle of an evening
const MAX_NAMES = 32;

const run = (bin, args) => new Promise((ok, fail) => execFile(bin, args, { timeout: 20000 }, (e) => (e ? fail(e) : ok())));

function parse(pem) {
  const key = /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]+?-----END [A-Z ]*PRIVATE KEY-----/.exec(pem)?.[0];
  const cert = /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/.exec(pem)?.[0];
  if (!key || !cert) return null;
  const x509 = new X509Certificate(cert);
  if (!x509.checkPrivateKey(createPrivateKey(key))) return null;
  const names = (x509.subjectAltName || '').split(',').map((s) => s.trim()).filter((s) => s.startsWith('IP Address:')).map((s) => s.slice('IP Address:'.length));
  return { key, cert, names, ends: new Date(x509.validTo).getTime() };
}

export async function readCert(dir) {
  try { return parse(await readFile(join(dir, CERT_FILE), 'utf8')); } catch { return null; }
}

// Apple's rules for a server certificate, which a page with an accepted warning does not escape: SHA-256, an RSA key of
// 2048 bits, the names in subjectAltName, serverAuth, and at most 825 days. All on one file, so a rename is the whole write.
function config(names) {
  const alt = [...names.map((ip) => `IP:${ip}`), 'DNS:localhost'].join(',');
  return `[req]\ndistinguished_name = dn\nprompt = no\nx509_extensions = v3\n[dn]\nCN = Racing Karts on this Mac\n[v3]\nbasicConstraints = critical,CA:FALSE\nkeyUsage = critical,digitalSignature,keyEncipherment\nextendedKeyUsage = serverAuth\nsubjectAltName = ${alt}\n`;
}

async function make(dir, names, bins) {
  const tmp = await mkdtemp(join(tmpdir(), 'racing-karts-cert-'));
  try {
    const cfg = join(tmp, 'c.cnf'), keyOut = join(tmp, 'k.pem'), certOut = join(tmp, 'c.pem');
    await writeFile(cfg, config(names));
    const args = ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', '397', '-keyout', keyOut, '-out', certOut, '-config', cfg];
    let done = false;
    for (const bin of bins) {
      try { await run(bin, args); done = true; break; } catch {}
    }
    if (!done) return null;
    const pem = `${await readFile(keyOut, 'utf8')}\n${await readFile(certOut, 'utf8')}`;
    await mkdir(dir, { recursive: true });
    const part = join(dir, `${CERT_FILE}.${process.pid}.${Date.now()}`);
    await writeFile(part, pem, { mode: 0o600 });
    await chmod(part, 0o600);
    await rename(part, join(dir, CERT_FILE));
    return parse(pem);
  } finally {
    await rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

// The certificate to serve, made or made again if needed: { key, cert, names, ends }, or null with no openssl to make one.
// must: the address phones reach right now. want: every other current one, for the names of a new certificate only.
export async function ensureCert({ dir, must = null, want = [], bins = OPENSSL, now = Date.now() } = {}) {
  const have = await readCert(dir);
  if (have && have.ends - now > MARGIN_MS && (!must || have.names.includes(must))) return have;
  const names = [...new Set(['127.0.0.1', ...(must ? [must] : []), ...want, ...(have?.names || [])])].slice(0, MAX_NAMES);
  return make(dir, names, bins);
}
