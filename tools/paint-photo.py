#!/usr/bin/env python3
"""Turns a real photo of a real mountain into a painted backdrop for the toon world. Local, no model, no network.

  python3 -I tools/paint-photo.py <photo> <out.jpg> --style illustrate --preset golden [--crop x0,y0,x1,y1] [--width 2400] [--foot 0.86]

Three styles. illustrate() is what the panoramas use: soft planes that run with the rock, the hour's rose ramp, thin pen strokes, to stand beside a hand repaint. cel() and strokes are older. What follows is the strokes pipeline, kept for reference.

Steps, each with a reason (docs/backdrops-howto.md has how to choose the parameters):
  1. Sky found (GrabCut seeded from the top rows, refined per column to the sharpest step), and thrown away: the sky of the
     painting comes from the preset, so that it is the same sky as the shader's and the seam cannot show.
  2. Colour cast of the hour taken out of the land, tone stretched per material: rock, snow, vegetation are told apart from
     colour and brightness, because each gets its own paint.
  3. Luminance painted: Kuwahara facets, then strokes along the local grain of the rock (line integral convolution on the
     structure tensor), then a shock filter that turns soft ramps into crisp shapes. This is what stops it reading as a filter.
  4. Tones posterised softly and mapped through a gradient per material: light rock cream, mid rock salmon, shade mauve.
     Colour no longer comes from the photo, it comes from the hour of the track.
  5. Ink: plum lines where the painted luminance really turns, long connected ones only, thick on the ridge line and thin on the face.
  6. Aerial perspective: the land goes cool and pale downward, and under `foot` it dissolves into the base mist, so that the
     foreground of the photo (roofs, cars, power lines) is gone. The renderer starts where this ends.

Prints a line of JSON: file, size, summit {u, row} (the highest point of the ridge line), mist colour, what to paste in the track.
"""
import argparse
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image


def hexrgb(h):
    h = h.strip().lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float32) / 255.0


def ramp(stops):
    """stops: ['#hex', ...] evenly spaced, or [(pos, '#hex'), ...]. Returns x, rgb arrays for np.interp, in gamma space."""
    if isinstance(stops[0], str):
        stops = [(i / (len(stops) - 1), s) for i, s in enumerate(stops)]
    return np.array([p for p, _ in stops], dtype=np.float32), np.stack([hexrgb(c) for _, c in stops])


def apply_ramp(v, r):
    x, c = r
    return np.dstack([np.interp(v, x, c[:, k]) for k in range(3)]).astype(np.float32)


# One preset per hour. rock, snow, green, gold: shade to light. sky: top to horizon. ink: the pen. mist: the air at the foot.
# The sky of `golden` is read off Summit Descent's antelao-summit.jpg, the painting everything else has to sit beside.
PRESETS = {
    'golden': {  # late autumn sun, pink rock, violet sky: Antelao
        'rock': [(0, '#5c5f7c'), (0.18, '#7a7c94'), (0.36, '#9a98a4'), (0.54, '#bab1ac'), (0.72, '#d6c8b6'), (0.88, '#e8d9c3'), (1, '#f6ead6')],
        'spruce': ['#142a2a', '#1f3f38', '#355f4a'], 'larch': ['#74502a', '#b98a34', '#ecba56'], 'alpine': [(0, '#6d6474'), (0.5, '#a08f82'), (1, '#cdb48a')],
        # the panorama's air and clouds (compose-panorama.py)
        'air': '#c9b3bd', 'belt_air': '#7f98a6', 'air_low': '#e9c7ab', 'air_high': '#c4b2d0', 'glow': '#ffdca6', 'cloud_lit': '#ffe7c9', 'cloud_shade': '#d5aec8', 'cloud_high': '#efd2d6', 'mist_fog': '#ecd9cf', 'cloud': 0.8,
        'snow': [(0, '#a3a0c4'), (0.4, '#cfc6d8'), (0.75, '#f1e6e0'), (1, '#fff7ee')],
        'green': [(0, '#24464c'), (0.35, '#335c5c'), (0.7, '#4f7a6c'), (1, '#7f9c78')],
        'gold': [(0, '#5f4a44'), (0.35, '#94693f'), (0.7, '#cf8c3e'), (1, '#f0b656')],
        'sky': [(0, '#c99cdc'), (0.28, '#d7a4d8'), (0.55, '#eaaecb'), (0.8, '#f8bdae'), (1, '#fdd0a2')],
        # the same sky by elevation in degrees, as it stands on antelao-summit.jpg placed at its width and height
        'sky_el': [(2, '#fdd8a8'), (6, '#fccfa4'), (10, '#f6c5ad'), (14, '#ecbdbf'), (18, '#dcb4cf'), (23, '#c7abd9'), (30, '#aea5de'), (45, '#98a0e0')],
        # the same evening as read off the Gemini Antelao of Summit Descent (antelao-summit.jpg): shade mauve, mid rose, lit peach, a cream for pale scree. illustrate() and the belts paint with these, so a photo stands beside that painting
        'rock_i': [(0, '#5c5478'), (0.14, '#7d7396'), (0.3, '#a58ba6'), (0.46, '#c49aa8'), (0.62, '#e0a9a8'), (0.78, '#f6bcab'), (0.9, '#fbd0be'), (1, '#fde8dc')],
        'foot_air': '#7fa4ab', 'far_air': '#a8b3cc', 'forest_i': ['#203f42', '#2f5a54', '#4c7a68'], 'larch_i': ['#8c5a35', '#c9823f', '#eeb060'],
        'ink': '#332a4a', 'mist': '#8fb3b4', 'haze': '#a7bfc4', 'warm': 0.12,
        # forest in mass, the 3D trees' own greens at their distance, and what distance does to them: one wood from the road to the far slopes
        'spruce_m': ['#0f2826', '#173a31', '#234f3f'], 'larch_m': ['#5c4a2c', '#8f682c', '#b98a3c'], 'forest_air': '#6d97a2',
    },
    'winter': {  # crisp blue winter, sun on snow: Pelmo d'Inverno
        'rock': [(0, '#3f4a6e'), (0.25, '#6d7898'), (0.5, '#a39fb4'), (0.75, '#d6c8c8'), (1, '#f8ece2')],
        'snow': [(0, '#9db7dc'), (0.45, '#cbdcf0'), (0.8, '#f0f5fb'), (1, '#ffffff')],
        'green': [(0, '#1f3f4e'), (0.4, '#2f5a60'), (1, '#6f9490')],
        'gold': [(0, '#34505a'), (1, '#8ea8a0')],
        'sky': [(0, '#6fa6e0'), (0.5, '#9cc6ee'), (0.85, '#cfe3f4'), (1, '#e9eff4')],
        'ink': '#26304e', 'mist': '#cfe0ee', 'haze': '#d8e6f2', 'warm': 0.04,
    },
    'winter_dusk': {  # low winter sun going to dusk, blue shadows and rose rock, deep clear sky: Pelmo d'Inverno
        'rock': [(0, '#3f4a6e'), (0.25, '#6d7898'), (0.5, '#a39fb4'), (0.75, '#d6c8c8'), (1, '#f8ece2')],
        'spruce': ['#16303a', '#20444a', '#3a6062'], 'larch': ['#3a5660', '#6f8c98', '#b6cbd6'], 'alpine': [(0, '#8c9dc8'), (0.45, '#c6cbe2'), (0.8, '#f6e4e0'), (1, '#fff4ec')],
        'air': '#c4bedb', 'belt_air': '#8ca2c4', 'air_low': '#f4cfc0', 'air_high': '#b4bce4', 'glow': '#ffd2a8', 'cloud_lit': '#ffe6d2', 'cloud_shade': '#c6a9cc', 'cloud_high': '#eed2de', 'mist_fog': '#e8dcea', 'cloud': 0.55,
        'snow': [(0, '#9db7dc'), (0.45, '#cbdcf0'), (0.8, '#f8eeee'), (1, '#fffaf6')],
        'green': [(0, '#1f3f4e'), (0.4, '#2f5a60'), (1, '#6f9490')],
        'gold': [(0, '#34505a'), (1, '#8ea8a0')],
        'sky': [(0, '#6a8fdc'), (0.5, '#9db4e6'), (0.85, '#f0c6c8'), (1, '#ffd8b4')],
        'sky_el': [(1, '#ffdcb6'), (5, '#fbd0bc'), (9, '#ecc4cc'), (13, '#d3bedc'), (18, '#b0b6e4'), (24, '#8fa8e4'), (32, '#7498e0'), (48, '#5c84d8')],
        # shade blue and violet, mid rose, lit peach, and the snow on the ledges nearly white: the ledges are what draw the Pelmo
        'rock_i': [(0, '#3a4170'), (0.14, '#565a8c'), (0.3, '#8078a8'), (0.46, '#ad8fb4'), (0.6, '#d9a4b4'), (0.74, '#f4bfb6'), (0.88, '#fddccf'), (1, '#fff5ee')],
        'foot_air': '#7f9cc4', 'far_air': '#a6b2d8', 'forest_i': ['#1c3842', '#2c5258', '#54807e'], 'larch_i': ['#49626e', '#7f98a8', '#c6d6e0'],
        'ink': '#262a54', 'mist': '#9fb6d8', 'haze': '#b6c6e0', 'warm': 0.1,
        # the forest in mass: spruce near blue black, the drifts are boughs under snow; frost: the snow on a tree, shade and lit
        'spruce_m': ['#1c3644', '#264a56', '#37626a'], 'larch_m': ['#5a7290', '#8299b4', '#b0c0d6'], 'forest_air': '#7f9ac4',
        'frost': ['#8c9fc2', '#f0f0f8'],
    },
    'morning': {  # summer morning, green and grey rock: Transfagarasan, Bali
        'rock': [(0, '#46505c'), (0.3, '#74808a'), (0.6, '#a8aca6'), (0.85, '#d8d4c4'), (1, '#f4eedd')],
        'snow': [(0, '#b0c4d8'), (0.5, '#dfe9ee'), (1, '#ffffff')],
        'green': [(0, '#22503c'), (0.35, '#3c7a48'), (0.7, '#6fa450'), (1, '#b4cc66')],
        'gold': [(0, '#54602e'), (1, '#c4c45a')],
        'sky': [(0, '#6cb0e4'), (0.55, '#a4d2ee'), (0.9, '#dcecec'), (1, '#f0eede')],
        'ink': '#23303a', 'mist': '#bcd8d8', 'haze': '#cde2e0', 'warm': 0.05,
    },
    'night': {  # friendly moonlight, teal and violet: Bran
        'rock': [(0, '#1c1f42'), (0.35, '#34396a'), (0.65, '#5f6a9a'), (1, '#b4c2dc')],
        'snow': [(0, '#4a5a90'), (0.6, '#8ca2cc'), (1, '#dfeaf6')],
        'green': [(0, '#0f2a3a'), (0.5, '#1d4650'), (1, '#3f7270')],
        'gold': [(0, '#2a2f4a'), (1, '#6a6f7e')],
        'sky': [(0, '#141a44'), (0.5, '#262a66'), (0.85, '#46408a'), (1, '#6a55a0')],
        'ink': '#0d0f26', 'mist': '#3c4a7c', 'haze': '#404e80', 'warm': 0.0,
    },
    'moonlight': {  # friendly moonlit night, teal and violet, the keys the panorama composer reads: Bran
        'rock': [(0, '#1c1f42'), (0.35, '#34396a'), (0.65, '#5f6a9a'), (1, '#b4c2dc')],
        'snow': [(0, '#4a5a90'), (0.6, '#8ca2cc'), (1, '#dfeaf6')],
        'green': [(0, '#0f2a3a'), (0.5, '#1d4650'), (1, '#3f7270')],
        'gold': [(0, '#2a2f4a'), (1, '#6a6f7e')],
        'sky': [(0, '#141a44'), (0.5, '#262a66'), (0.85, '#46408a'), (1, '#6a55a0')],
        'sky_el': [(0, '#3f8092'), (3, '#3b7490'), (7, '#35628c'), (12, '#2f4e84'), (18, '#2a407a'), (25, '#25356e'), (33, '#1e2b5e'), (50, '#161f48')],
        # slate in the shade, steel in the middle, what the moon reaches is pale limestone: rock at night, not lavender
        'rock_i': [(0, '#1e2846'), (0.14, '#2b3858'), (0.3, '#41516c'), (0.46, '#5e7084'), (0.62, '#8294a0'), (0.78, '#acbabe'), (0.9, '#d2dadb'), (1, '#eef2ee')],
        'alpine': [(0, '#2a3364'), (0.5, '#3e5c84'), (1, '#5f8c92')],
        'air': '#5a7098', 'belt_air': '#3d6488', 'air_low': '#4a7f96', 'air_high': '#4e6090', 'glow': '#c8e4e6',
        'cloud_lit': '#8ea8c8', 'cloud_shade': '#2e3f70', 'cloud_high': '#4f6898', 'mist_fog': '#3a5a80', 'cloud': 0.26,
        'foot_air': '#3f7690', 'far_air': '#5070a4', 'forest_i': ['#10283c', '#173c4e', '#28605f'], 'larch_i': ['#143a44', '#1f5558', '#2e6e68'],
        'ink': '#14133a', 'mist': '#2d5a6e', 'haze': '#404e80', 'warm': 0.0,
        'spruce_m': ['#0c2036', '#123348', '#1b4a56'], 'larch_m': ['#123a46', '#1b5258', '#2a6c68'], 'forest_air': '#2f5680',
    },
    'sunrise': {  # pink and orange sunrise over grey sand: Bromo
        'rock': [(0, '#4a3a58'), (0.3, '#806080'), (0.55, '#b98692'), (0.8, '#eab49a'), (1, '#ffe2bd')],
        'snow': [(0, '#c0a0c8'), (0.6, '#f4d4d0'), (1, '#fff4e6')],
        'green': [(0, '#2e4040'), (0.5, '#5a6a50'), (1, '#a09458')],
        'gold': [(0, '#6a4a3a'), (1, '#e8a860')],
        'sky': [(0, '#7f8fd8'), (0.4, '#c4a0d4'), (0.72, '#f4b0a8'), (1, '#ffcf98')],
        'ink': '#30243e', 'mist': '#e8bfae', 'haze': '#efc8b4', 'warm': 0.14,
        # the panorama's keys, read off the dawn photo of Batok (Halun, 20/08/2022): rust and orange where the sun lands, plum in the flutes, slate blue walls and a violet mist on the floor
        'sky_el': [(0, '#f9d0a6'), (3, '#f8c3a2'), (7, '#f3b4a8'), (12, '#e6aab8'), (18, '#cca5cc'), (25, '#a8a1d8'), (33, '#8c9edd'), (50, '#789be0')],
        'rock_i': [(0, '#3a2a40'), (0.14, '#553446'), (0.3, '#7c4346'), (0.46, '#a65a44'), (0.62, '#c97a4c'), (0.78, '#e49c62'), (0.9, '#f4bd86'), (1, '#fde0bc')],
        'alpine': [(0, '#3f3f5a'), (0.5, '#5d6470'), (1, '#8f8c78')],
        'air': '#d8a9b4', 'belt_air': '#8f8fb4', 'air_low': '#f0c0a8', 'air_high': '#b4a2d2', 'glow': '#ffd9a0', 'cloud_lit': '#ffe2c0', 'cloud_shade': '#c49abd', 'cloud_high': '#f2c4cc', 'mist_fog': '#e6c2c6', 'cloud': 0.55,
        'foot_air': '#8e8cb8', 'far_air': '#a39ec8', 'forest_i': ['#20303c', '#2f4648', '#4f6a58'], 'larch_i': ['#3a4644', '#55604e', '#7a7a58'],
        'spruce_m': ['#172a36', '#223c44', '#33564f'], 'larch_m': ['#2c3c40', '#40524c', '#586a56'], 'forest_air': '#7f83ad',
    },
    'tropical': {  # warm tropical midday on Gunung Agung: lava slate, jungle green, white cumulus, read off the Besakih photo (Aranas): Bali
        'rock': [(0, '#3e4a48'), (0.35, '#6f7c70'), (0.7, '#a8ae98'), (1, '#e8e6d0')],
        'snow': [(0, '#c0d4e0'), (1, '#ffffff')],
        'green': [(0, '#1a5a3e'), (0.35, '#2f8a4c'), (0.7, '#62b352'), (1, '#b2d65c')],
        'gold': [(0, '#3f7a3e'), (1, '#c2d05a')],
        'sky': [(0, '#3e9ce8'), (0.6, '#7cc4f2'), (1, '#d4eef6')],
        'sky_el': [(0, '#f3f4dc'), (2, '#e3f1e4'), (5, '#c9e9ec'), (9, '#a9dcf0'), (14, '#88cdee'), (21, '#66bbea'), (30, '#4ba8e5'), (50, '#3592dd')],
        'rock_i': [(0, '#343c50'), (0.14, '#4a5166'), (0.3, '#686a7a'), (0.46, '#8a8589'), (0.62, '#a9a096'), (0.78, '#c8baa4'), (0.9, '#ddd0b8'), (1, '#f0e6d2')],
        'green_i': [(0, '#104a4c'), (0.14, '#15604f'), (0.3, '#1d7a54'), (0.46, '#2f9456'), (0.62, '#50ad58'), (0.78, '#82c65c'), (0.9, '#a9d662'), (1, '#cfe578')],
        'alpine': [(0, '#215a4c'), (0.5, '#3f8e56'), (1, '#86bd5e')],
        'air': '#b9dcef', 'belt_air': '#8cc6c4', 'air_low': '#dcefdc', 'air_high': '#a0cdee', 'glow': '#fff6da',
        'cloud_lit': '#ffffff', 'cloud_shade': '#c3d8ea', 'cloud_high': '#f4fbff', 'mist_fog': '#e2f2ea', 'cloud': 1.0, 'cloud_up': True,
        'foot_air': '#8fccc2', 'far_air': '#a4cfe4', 'forest_i': ['#114a3e', '#1c6e4c', '#3e9a56'], 'larch_i': ['#3a7c3e', '#6fa844', '#a8c850'],
        'ink': '#14303a', 'mist': '#9fd6c8', 'haze': '#bfe4e0', 'warm': 0.03,
        'spruce_m': ['#0d4034', '#165e48', '#26804f'], 'larch_m': ['#2c7a40', '#4e9c44', '#86bc4c'], 'forest_air': '#84bfc8',
    },
    'midday': {  # lush green midday, white clouds: Bali, Jakarta
        'rock': [(0, '#3e4a48'), (0.35, '#6f7c70'), (0.7, '#a8ae98'), (1, '#e8e6d0')],
        'snow': [(0, '#c0d4e0'), (1, '#ffffff')],
        'green': [(0, '#1a5a3e'), (0.35, '#2f8a4c'), (0.7, '#62b352'), (1, '#b2d65c')],
        'gold': [(0, '#3f7a3e'), (1, '#c2d05a')],
        'sky': [(0, '#3e9ce8'), (0.6, '#7cc4f2'), (1, '#d4eef6')],
        'ink': '#1e3030', 'mist': '#c4e4e2', 'haze': '#d4ecea', 'warm': 0.03,
    },
}
# Bali, the last hour before the sun goes down over the sea behind Tanah Lot: peach and rose low in the sky, warm rock on Batur's lit face, jungle greens with gold in them. Read off the Batur and Tanah Lot photos.
PRESETS['bali_sunset'] = {
    **PRESETS['tropical'],
    'sky_el': [(0, '#ffd8a4'), (2, '#ffd3a6'), (5, '#fbcbaa'), (9, '#f2c2b2'), (14, '#dcbcc4'), (20, '#b8bcd8'), (28, '#92b6e0'), (38, '#74a8de'), (50, '#5c9ad8')],
    'rock_i': [(0, '#2e2a38'), (0.14, '#463c48'), (0.3, '#66524f'), (0.46, '#8c6c58'), (0.62, '#ad8864'), (0.78, '#cfa778'), (0.9, '#e7c592'), (1, '#f8e2bc')],
    'green_i': [(0, '#16443c'), (0.14, '#1f5a42'), (0.3, '#2f7446'), (0.46, '#4c8e48'), (0.62, '#74a64a'), (0.78, '#a3b950'), (0.9, '#c6c85c'), (1, '#e2d878')],
    'alpine': [(0, '#2e5a44'), (0.5, '#5f8c48'), (1, '#a9ad58')],
    'air': '#dcbcb4', 'belt_air': '#b0aa9c', 'air_low': '#f4d6b8', 'air_high': '#bcb8d4', 'glow': '#ffbe7a',
    'cloud_lit': '#fff1da', 'cloud_shade': '#c8a0ae', 'cloud_high': '#ffe6d0', 'mist_fog': '#f0d8c0', 'cloud': 1.0, 'cloud_up': False,
    'foot_air': '#b4a8ac', 'far_air': '#bda9bc', 'forest_i': ['#163e38', '#25603f', '#4c8a48'], 'larch_i': ['#4f8238', '#83a33e', '#b7b84c'],
    'ink': '#2a2430', 'mist': '#c4b09c', 'haze': '#e6ccb4', 'warm': 0.05,
    'spruce_m': ['#143a32', '#205a3e', '#387a44'], 'larch_m': ['#3f7c3a', '#6a9c40', '#a3ae4c'], 'forest_air': '#a9a2ac',
}
# Jakarta, late afternoon through the haze: peach low in the sky under a clean blue, glass and concrete with warm light on them, the green of a city full of rain trees. Read off the Thamrin-Sudirman photos.
PRESETS['jakarta'] = {
    **PRESETS['tropical'],
    'sky_el': [(0, '#f8e2c4'), (3, '#f6dcc0'), (8, '#e8dfca'), (15, '#bfe0e4'), (24, '#8fd0e8'), (40, '#62b8e8'), (60, '#4aa4e2')],
    'rock_i': [(0, '#3f4f66'), (0.16, '#566c84'), (0.32, '#7690a4'), (0.5, '#9bb0ba'), (0.66, '#bcc6c4'), (0.82, '#dcd8c8'), (0.92, '#f0e6d0'), (1, '#fff4dc')],
    'green_i': [(0, '#1f5a44'), (0.2, '#2f7a4c'), (0.45, '#4c9a52'), (0.7, '#7cb45a'), (1, '#b8cc6c')],
    'alpine': [(0, '#3a6a54'), (0.5, '#6a9458'), (1, '#a8b464')],
    'air': '#e8dcc8', 'belt_air': '#c4c8b4', 'air_low': '#f4e0c4', 'air_high': '#c8d8dc', 'glow': '#ffe2b4',
    'cloud_lit': '#fff6e6', 'cloud_shade': '#c9c6d4', 'cloud_high': '#fff0dc', 'mist_fog': '#efe0ca', 'cloud': 0.8, 'cloud_up': False,
    'foot_air': '#bcc2b0', 'far_air': '#c8ccc0', 'forest_i': ['#1c5040', '#2f7248', '#5a9a52'], 'larch_i': ['#4c8a44', '#7aa84c', '#a8bc58'],
    'ink': '#2a2c38', 'mist': '#c4c8b4', 'haze': '#e8dcc8', 'warm': 0.04,
    'spruce_m': ['#1c5040', '#2a6c46', '#4a8c4e'], 'larch_m': ['#4c8a44', '#6e9c4a', '#98b054'], 'forest_air': '#b4bcac',
}
# Summer morning at Bâlea: the first sun rose on the crests, olive and gold on the open grass, peach under lilac in the sky, teal air in the valley. Every colour read off carpazi.jpg and carpazi-summit.jpg (Summit Descent, Gemini repaints of the real photos).
PRESETS['balea'] = {
    **PRESETS['golden'],
    'sky_el': [(0, '#fdd2ae'), (5, '#fccdb0'), (10, '#f6c4b8'), (15, '#ecbcc6'), (20, '#dfb3d2'), (26, '#d0a9da'), (34, '#bda3de'), (50, '#a79fe0')],
    'rock_i': [(0, '#6d6480'), (0.18, '#8f8492'), (0.36, '#b49a9e'), (0.54, '#daa89f'), (0.72, '#f5b8a6'), (0.88, '#fccab2'), (1, '#ffe6d4')],
    'grass_i': [(0, '#3f5a58'), (0.22, '#566a54'), (0.45, '#7d7f50'), (0.66, '#a8955a'), (0.85, '#c8ad66'), (1, '#e2c882')],
    'alpine': [(0, '#56665a'), (0.5, '#8a8a58'), (1, '#bda763')],
    'grass_m': ['#4f6556', '#7c7f52', '#a8975c'], 'grass2_m': ['#6f7d4f', '#9e9a58', '#c7b367'],
    'spruce_m': ['#1f3f3f', '#2a5550', '#3f6f60'], 'larch_m': ['#2a5550', '#3f6f60', '#55806a'],
    'forest_air': '#9aa68c', 'forest_i': ['#2a4f4c', '#3f6a5c', '#5f8a6c'], 'larch_i': ['#6f7d4f', '#9e9a58', '#c7b367'],
    'air': '#d6bcc8', 'belt_air': '#8fb0a8', 'air_low': '#efc9ae', 'air_high': '#cdb3d6', 'glow': '#ffe0b0',
    'cloud_lit': '#ffe6c8', 'cloud_shade': '#e9b6bc', 'cloud_high': '#f3cfd2', 'mist_fog': '#efd8cf', 'cloud': 0.55,
    'foot_air': '#7fa8a6', 'far_air': '#b4b6cf', 'ink': '#3a2f46', 'mist': '#8fb0a8', 'haze': '#b4c0c4', 'warm': 0.1,
}


# Bâlea in the late morning of a clear summer day, as the photos have it: dark grey schist, grey scree, muted green grass, a blue sky paling to the horizon with white cumulus. Read off 02.09.2025 Balea-See and Baleasee.
PRESETS['balea_day'] = {
    **PRESETS['balea'],
    'sky_el': [(0, '#dfe9ec'), (3, '#d3e4ec'), (7, '#bcd8ec'), (12, '#a2cbea'), (18, '#88bce6'), (26, '#70ade2'), (38, '#5a9edc'), (55, '#4a90d6')],
    'rock_i': [(0, '#23272f'), (0.14, '#363a42'), (0.3, '#50534f'), (0.46, '#6e6f69'), (0.62, '#8d8c82'), (0.78, '#aeaa9c'), (0.9, '#cbc6b6'), (1, '#e6e2d4')],
    'grass_i': [(0, '#2b3a30'), (0.22, '#3f4d38'), (0.45, '#5b663f'), (0.66, '#777d48'), (0.85, '#958f56'), (1, '#b2a86a')],
    'alpine': [(0, '#3f4d38'), (0.5, '#646c44'), (1, '#958f56')],
    'grass_m': ['#434f39', '#5f6841', '#7b7f4a'], 'grass2_m': ['#525d40', '#727748', '#958f56'],
    'spruce_m': ['#1f3f35', '#2a5040', '#3a644a'], 'larch_m': ['#2a5040', '#3a644a', '#50764f'],
    'forest_air': '#9ab0b0', 'forest_i': ['#2a4c40', '#3a5f4a', '#527654'], 'larch_i': ['#4f6640', '#6e8248', '#8f9c54'],
    'air': '#b8ccda', 'belt_air': '#a0b4b4', 'air_low': '#dbe6e6', 'air_high': '#a8c8e4', 'glow': '#fff4dc',
    'cloud_lit': '#ffffff', 'cloud_shade': '#c6d4e2', 'cloud_high': '#f4f9fc', 'mist_fog': '#e6edf0', 'cloud': 0.9, 'cloud_up': True,
    'foot_air': '#9fb2b4', 'far_air': '#aac2d8', 'ink': '#1e2228', 'mist': '#8f9f8a', 'haze': '#c4d4dc', 'warm': 0.02,
}


def box(img, r):
    return cv2.boxFilter(img, -1, (2 * r + 1, 2 * r + 1), borderType=cv2.BORDER_REFLECT)


def kuwahara(v, r):
    """Four quadrants, take the mean of the calmest: flat facets with their edges kept. Works on one float channel."""
    k = np.ones((r + 1, r + 1), np.float32) / (r + 1) ** 2
    means, vars_ = [], []
    sq = v * v
    for ax, ay in ((r, r), (0, r), (r, 0), (0, 0)):  # anchors: the kernel's window lies up-left, up-right, down-left, down-right
        m = cv2.filter2D(v, -1, k, anchor=(ax, ay), borderType=cv2.BORDER_REFLECT)
        s = cv2.filter2D(sq, -1, k, anchor=(ax, ay), borderType=cv2.BORDER_REFLECT) - m * m
        means.append(m)
        vars_.append(s)
    idx = np.argmin(np.stack(vars_), axis=0)
    return np.take_along_axis(np.stack(means), idx[None], axis=0)[0]


def flow(v, grad=1.2, tensor=5.0):
    """Unit tangent of the local grain (along the edges), and how strongly there is one (0..1)."""
    g = cv2.GaussianBlur(v, (0, 0), grad)
    gx, gy = cv2.Sobel(g, cv2.CV_32F, 1, 0, ksize=3), cv2.Sobel(g, cv2.CV_32F, 0, 1, ksize=3)
    a, b, c = cv2.GaussianBlur(gx * gx, (0, 0), tensor), cv2.GaussianBlur(gx * gy, (0, 0), tensor), cv2.GaussianBlur(gy * gy, (0, 0), tensor)
    d = np.sqrt(np.maximum((a - c) ** 2 + 4 * b * b, 0))
    # the eigenvector of the small eigenvalue runs along the edge
    l2 = 0.5 * (a + c - d)
    tx, ty = b, l2 - a
    n = np.sqrt(tx * tx + ty * ty) + 1e-7
    return tx / n, ty / n, np.clip(d / (a + c + 1e-6), 0, 1)


def lic(v, tx, ty, steps=7, h=1.1):
    """Smooths along the flow: each pixel averages along its own streamline both ways, so strokes run with the rock."""
    H, W = v.shape
    X, Y = np.meshgrid(np.arange(W, dtype=np.float32), np.arange(H, dtype=np.float32))
    out, wt = v.copy(), 1.0
    for sign in (1.0, -1.0):
        px, py = X.copy(), Y.copy()
        lx, ly = tx * sign, ty * sign
        for s in range(1, steps + 1):
            fx = cv2.remap(tx, px, py, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
            fy = cv2.remap(ty, px, py, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
            flip = np.where(fx * lx + fy * ly < 0, -1.0, 1.0).astype(np.float32)
            lx, ly = fx * flip, fy * flip
            px, py = px + lx * h, py + ly * h
            w = float(np.exp(-0.5 * (s / (steps * 0.55)) ** 2))
            out += cv2.remap(v, px, py, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT) * w
            wt += w
    return out / wt


def shock(v, iters=4, dt=0.35, sigma=1.4):
    """Osher and Rudin: pushes each side of a soft ramp to its own level, a crisp painted edge instead of a blur."""
    for _ in range(iters):
        s = cv2.GaussianBlur(v, (0, 0), sigma)
        gx, gy = cv2.Sobel(s, cv2.CV_32F, 1, 0, ksize=3) / 8, cv2.Sobel(s, cv2.CV_32F, 0, 1, ksize=3) / 8
        xx, yy, xy = cv2.Sobel(s, cv2.CV_32F, 2, 0, ksize=3) / 4, cv2.Sobel(s, cv2.CV_32F, 0, 2, ksize=3) / 4, cv2.Sobel(s, cv2.CV_32F, 1, 1, ksize=3) / 4
        vee = gx * gx * xx + 2 * gx * gy * xy + gy * gy * yy
        mag = np.sqrt(cv2.Sobel(v, cv2.CV_32F, 1, 0, ksize=1) ** 2 + cv2.Sobel(v, cv2.CV_32F, 0, 1, ksize=1) ** 2) * 0.5
        v = v - dt * np.tanh(vee * 4000) * mag
    return v


def posterise(v, n, soft=0.22):
    x = np.clip(v, 0, 1) * n
    f = x - np.floor(x)
    e = np.clip((f - (0.5 - soft)) / (2 * soft), 0, 1)
    return np.clip((np.floor(x) + e * e * (3 - 2 * e)) / n, 0, 1)


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def fbm(shape, scale, seed, octaves=3):
    """Cheap value noise from resized random grids, 0..1."""
    rng = np.random.default_rng(seed)
    H, W = shape
    out, amp, tot = np.zeros(shape, np.float32), 1.0, 0.0
    for o in range(octaves):
        s = scale / 2 ** o
        gh, gw = max(2, int(H / s) + 2), max(2, int(W / s) + 2)
        out += cv2.resize(rng.random((gh, gw), dtype=np.float32), (W, H), interpolation=cv2.INTER_CUBIC) * amp
        tot += amp
        amp *= 0.55
    return np.clip(out / tot, 0, 1)


def find_sky(rgb, top_frac=0.04, land_from=0.8, cloud=0.0):
    """Ridge row per column at full resolution, and the sky mask (float, 1 above the ridge)."""
    H, W = rgb.shape[:2]
    sw = min(W, 1800)
    sh = int(H * sw / W)
    small = cv2.resize(rgb, (sw, sh), interpolation=cv2.INTER_AREA)
    bgr = (small[:, :, ::-1] * 255).astype(np.uint8)
    lab = cv2.cvtColor(small, cv2.COLOR_RGB2LAB)
    sk = lab[: max(2, int(sh * top_frac))].reshape(-1, 3)
    d = np.sqrt(((lab - np.median(sk, axis=0)) ** 2).sum(axis=2))
    mask = np.where(d < 22, cv2.GC_PR_FGD, cv2.GC_PR_BGD).astype(np.uint8)
    mask[: max(2, int(sh * top_frac))] = cv2.GC_FGD
    mask[int(sh * land_from):] = cv2.GC_BGD
    white = None
    if cloud > 0:
        # a white cloud against the ridge is not land: bright, without colour, and smooth where rock is broken
        L = lab[:, :, 0]
        chroma = np.hypot(lab[:, :, 1], lab[:, :, 2])
        rough = cv2.GaussianBlur(np.abs(L - cv2.GaussianBlur(L, (0, 0), 2.5)), (0, 0), 3)
        white = ((L > 72) & (chroma < 18) & (rough < cloud)).astype(np.uint8)
        white = cv2.morphologyEx(white, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
        mask[(white > 0) & (mask != cv2.GC_BGD)] = cv2.GC_FGD
    cv2.grabCut(bgr, mask, None, np.zeros((1, 65)), np.zeros((1, 65)), 6, cv2.GC_INIT_WITH_MASK)
    sky = ((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD)).astype(np.uint8)
    if white is not None:
        sky[white > 0] = 1
    # only what connects to the top is sky: snow and pale rock under the ridge are not
    n, labels = cv2.connectedComponents(sky)
    keep = np.unique(labels[0][sky[0] > 0])
    sky = np.isin(labels, keep[keep > 0]).astype(np.uint8)
    # the first land from the top of each column, with specks of land in the sky (a wisp of cloud) ignored
    land = cv2.morphologyEx(1 - sky, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    first = np.where(land.any(axis=0), land.argmax(axis=0), sh - 1).astype(np.float32)
    # refine at full resolution: inside a small window per column, the row of the sharpest step down from the sky
    full = cv2.resize(first[None], (W, 1), interpolation=cv2.INTER_LINEAR)[0] * H / sh
    full = cv2.medianBlur(full.reshape(1, -1).astype(np.float32), 3)[0]
    gray = cv2.GaussianBlur(cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB), (0, 0), 0.8)
    dy = np.abs(gray[1:] - gray[:-1]).sum(axis=2)
    win = max(3, int(H / sh * 1.6))
    ridge = np.zeros(W, np.float32)
    for x in range(W):
        y0, y1 = max(0, int(full[x]) - win), min(H - 2, int(full[x]) + win)
        ridge[x] = y0 + float(np.argmax(dy[y0:y1 + 1, x])) if y1 > y0 else full[x]
    # one wild column must not bite the skyline: a light median, keeping peaks a few pixels wide, then a touch of blur so no pixel stairs show when it is enlarged
    ridge = cv2.medianBlur(ridge.reshape(1, -1), 5)[0]
    ridge = cv2.GaussianBlur(ridge.reshape(1, -1), (0, 0), 1.2)[0]
    Y = np.arange(H, dtype=np.float32)[:, None]
    mask = np.clip(ridge[None, :] + 1.0 - Y, 0, 1).astype(np.float32)
    return ridge, mask


def row_sky(P, a, ridge, H, W):
    """The sky of the hour, row by row: by real elevation with --place (the same on every panel and the dome), else from the top row to just under the ridge."""
    sky_bottom = a.sky_bottom if a.sky_bottom is not None else min(1.0, float(np.percentile(ridge, 92) / H) + 0.05)
    if a.place and P.get('sky_el'):
        width, elev = [float(q) for q in a.place.split(',')]
        top_x = int(np.argmin(cv2.GaussianBlur(ridge.reshape(1, -1), (0, 0), 3)[0]))
        hy = np.radians(width) / (W / H)
        rows = np.arange(H, dtype=np.float32) / H
        el = np.degrees(np.arctan(np.tan(np.radians(elev)) + (float(ridge[top_x]) / H - rows) * hy))
        xs, cs = np.array([e for e, _ in P['sky_el']], dtype=np.float32), np.stack([hexrgb(c) for _, c in P['sky_el']])
        sky = np.stack([np.interp(el, xs, cs[:, k]) for k in range(3)], axis=1)[:, None, :].repeat(W, axis=1).astype(np.float32)
    else:
        sv = np.clip(np.arange(H, dtype=np.float32) / (sky_bottom * H), 0, 1)
        sky = apply_ramp(sv[:, None].repeat(W, axis=1), ramp(P['sky']))
    return sky * (1 + (fbm((H, W), 300 * W / 2400.0, 21, 2)[..., None] - 0.5) * 0.012)


def sky_only(rgb, P, a):
    """For a painting that is already right (a Gemini one): the land stays, the sky becomes the track's."""
    H, W = rgb.shape[:2]
    # a painting has a pen: going down each column, the first dark step is the ridge, however pale the snow under it
    g = cv2.GaussianBlur(cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY), (0, 0), 1.0)
    # the sky's own slow gradient and brush drift stay well under a line's step
    step = g[:-3] - g[3:]
    first = np.argmax(step > a.pen_step, axis=0).astype(np.float32)
    first[~(step > a.pen_step).any(axis=0)] = H - 1
    ridge = cv2.medianBlur(first.reshape(1, -1), 5)[0]
    Y = np.arange(H, dtype=np.float32)[:, None]
    mask = np.clip(ridge[None, :] + 1.0 - Y, 0, 1).astype(np.float32)
    return rgb * (1 - mask[..., None]) + row_sky(P, a, ridge, H, W) * mask[..., None], ridge


def paint(rgb, P, a):
    H, W = rgb.shape[:2]
    scale = W / 2400.0
    ridge, sky_mask = find_sky(rgb, a.sky_top, a.land_from, a.cloud)
    land_mask = sky_mask < 0.5

    # 2. The cast of the hour out: the land's mean colour pulled to neutral, per channel in LAB.
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    L, A, B = lab[:, :, 0] / 100.0, lab[:, :, 1].copy(), lab[:, :, 2].copy()
    nz = land_mask & (L > 0.25) & (np.abs(A) < 25)
    if nz.sum() > 500:
        B -= np.median(B[nz & (L > 0.55)]) if (nz & (L > 0.55)).sum() > 500 else np.median(B[nz])
        A -= np.median(A[nz])
    chroma = np.sqrt(A * A + B * B)
    # materials: vegetation is dark or green or ochre, snow bright and colourless, rock what remains. Blurred a little: flat shapes.
    veg = smoothstep(3, 10, -A) * smoothstep(0.9, 0.55, L) + smoothstep(a.veg_dark + 0.1, a.veg_dark - 0.05, L) * a.dark_veg
    veg = np.clip(veg + smoothstep(16, 30, B) * smoothstep(0.75, 0.5, L) * 0.9, 0, 1)
    # vegetation does not grow on a summit: nothing green in the top of the massif, whatever the shadows say
    rel = (np.arange(H, dtype=np.float32)[:, None] - ridge[None, :]) / (a.foot * H - ridge[None, :] + 1e-3)
    veg *= smoothstep(a.veg_from - 0.1, a.veg_from + 0.08, rel)
    veg = cv2.GaussianBlur(veg.astype(np.float32), (0, 0), 5 * scale)
    veg = smoothstep(0.42, 0.6, veg)
    # holes in a forest are shadows, not rock
    veg = cv2.morphologyEx(veg, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(15 * scale) | 1, int(15 * scale) | 1)))
    snow = smoothstep(a.snow, a.snow + 0.09, L) * smoothstep(20, 9, chroma) * (1 - veg)
    snow = cv2.GaussianBlur(snow.astype(np.float32), (0, 0), 1.2 * scale)
    snow = smoothstep(0.35, 0.6, snow)
    gold_amt = smoothstep(8, 20, B) * veg  # real larches in the photo
    if a.larch > 0:
        # groves in a larger drift, single trees inside them: never camouflage patches
        drift_g = fbm((H, W), 260 * scale, 11, 2)
        speck = fbm((H, W), 30 * scale, 13, 2)
        gold_amt = np.maximum(gold_amt, smoothstep(0.5, 0.56, speck + (drift_g - 0.5) * 1.1 + (a.larch - 0.5) * 0.5) * veg)

    # 3. Paint the luminance: tone stretched on the rock alone, so shadows stay shadows on every photo.
    rock_px = land_mask & (veg < 0.5) & (snow < 0.5)
    lo, hi = np.percentile(L[rock_px], [a.lo, a.hi]) if rock_px.sum() > 500 else (0.1, 0.9)
    v = np.clip((L - lo) / max(hi - lo, 1e-3), 0, 1.25).astype(np.float32)
    # the sky must not bleed through the filters into the crest
    fill = float(np.median(v[land_mask & (rel < 0.15)])) if (land_mask & (rel < 0.15)).sum() > 100 else 0.7
    v = v * (1 - sky_mask) + fill * sky_mask
    v = kuwahara(v, max(2, int(round(a.facet * scale))))
    tx, ty, coh = flow(v, 1.3 * scale, 5.5 * scale)
    for _ in range(a.strokes):
        v = lic(v, tx, ty, steps=max(3, int(6 * scale)), h=1.1)
        tx, ty, coh = flow(v, 1.3 * scale, 5.5 * scale)
    pen = v.copy()
    v = shock(v, iters=a.shock, dt=0.3, sigma=max(1.0, 1.6 * scale))
    v = kuwahara(v, max(1, int(round(a.facet * 0.5 * scale))))
    # the low frequencies lifted, as a painter does: broad masses read from far, detail stays on top
    broad = cv2.GaussianBlur(v, (0, 0), 28 * scale)
    v = np.clip(v + a.local * (v - broad), 0, 1.2)
    # auto exposure: the middle of the rock lands on the same tone on every photo, whatever its light was
    if rock_px.sum() > 500:
        med = float(np.median(np.clip(v[rock_px], 0.02, 1)))
        gam = np.log(a.mid) / np.log(med) * a.gamma
    else:
        gam = a.gamma
    tones = posterise(np.clip(v, 0, 1) ** gam, a.tones, soft=a.soft)
    # the broad form of the mountain carries the light: planes facing away stay in the mauve whatever their fine detail says
    tones = tones * (1 - a.form) + np.clip(cv2.GaussianBlur(tones, (0, 0), 9 * scale) ** 1.1, 0, 1) * a.form
    if a.grain > 0:
        # dry brush: white noise smeared along the grain, a stroke that follows the rock
        rng = np.random.default_rng(5)
        noise = cv2.GaussianBlur(rng.random((H, W), dtype=np.float32), (0, 0), 0.8 * scale)
        streak = lic(lic(noise, tx, ty, steps=max(6, int(14 * scale)), h=1.2), tx, ty, steps=max(6, int(14 * scale)), h=1.2)
        streak = (streak - streak.mean()) / (streak.std() + 1e-6)
        tones = np.clip(tones + a.grain * 0.06 * np.clip(streak, -2, 2) * coh ** 0.5, 0, 1)

    # 4. Colour by material, through the hour's gradients.
    rock = apply_ramp(tones, ramp(P['rock']))
    # warm on the high rock, cool in the gullies: the enrosadira and the shade of the hour
    warmth = smoothstep(0.9, 0.05, rel) * P.get('warm', 0)
    rock = rock * (1 + warmth[..., None] * np.array([0.25, 0.02, -0.1], dtype=np.float32))
    hue = fbm((H, W), 220 * scale, 3, 3)[..., None] - 0.5
    rock = rock * (1 + hue * np.array([0.1, 0.0, -0.08], dtype=np.float32))
    snow_c = apply_ramp(np.clip((L - a.snow * 0.72) / (1 - a.snow * 0.72), 0, 1) * 0.5 + posterise(np.clip((L - a.snow * 0.72) / (1 - a.snow * 0.72), 0, 1), 4) * 0.5, ramp(P['snow']))
    # forest: its own tone stretch, flat masses with the tree tops broken up
    vv = np.clip((L - np.percentile(L[veg > 0.5], 3)) / max(np.percentile(L[veg > 0.5], 97) - np.percentile(L[veg > 0.5], 3), 1e-3), 0, 1).astype(np.float32) if (veg > 0.5).sum() > 500 else tones
    vv = kuwahara(vv, max(2, int(round(3 * scale))))
    vv = posterise(vv * 0.85 + 0.15 * fbm((H, W), 9 * scale, 17, 1), 5, soft=0.3)
    greens = apply_ramp(vv, ramp(P['green']))
    golds = apply_ramp(vv, ramp(P['gold']))
    forest = greens * (1 - gold_amt[..., None]) + golds * gold_amt[..., None]
    out = rock * (1 - veg[..., None]) + forest * veg[..., None]
    out = out * (1 - snow[..., None]) + snow_c * snow[..., None]

    # 5. Ink: a thin pen, on the real turns of the rock only. Canny gives lines one pixel wide, the long chains are kept, and
    # the pressure follows how strong the edge is, so that a line fades out instead of ending in a blob.
    src = np.clip(cv2.GaussianBlur(pen, (0, 0), 1.0 * scale), 0, 1)
    gx, gy = cv2.Sobel(src, cv2.CV_32F, 1, 0, ksize=3), cv2.Sobel(src, cv2.CV_32F, 0, 1, ksize=3)
    mag = np.sqrt(gx * gx + gy * gy)
    edges = cv2.Canny((src * 255).astype(np.uint8), int(a.ink_t * 0.45), int(a.ink_t), apertureSize=3, L2gradient=True)
    edges[sky_mask > 0.3] = 0
    n, cc, stats, _ = cv2.connectedComponentsWithStats(edges, connectivity=8)
    if n > 1:
        long_enough = stats[:, cv2.CC_STAT_AREA] >= a.ink_len * scale
        long_enough[0] = False
        edges = long_enough[cc].astype(np.uint8)
    press = np.clip(mag / (np.percentile(mag[edges > 0], 85) + 1e-6), 0.35, 1) if edges.any() else 1.0
    thin = cv2.GaussianBlur(edges.astype(np.float32) * press, (0, 0), a.pen * scale) * (2.5 * a.pen * scale)
    if a.fine > 0:
        # a second, finer pen from the photo's own detail, straightened along the grain: the small ribs and ledges of the rock
        det = lic(cv2.GaussianBlur(np.clip(L, 0, 1).astype(np.float32), (0, 0), 0.7 * scale), tx, ty, steps=max(4, int(8 * scale)), h=1.0)
        e2 = cv2.Canny((np.clip(det * (1 - sky_mask) + sky_mask * fill, 0, 1) * 255).astype(np.uint8), int(a.fine_t * 0.5), int(a.fine_t), apertureSize=3, L2gradient=True)
        n2, cc2, st2, _ = cv2.connectedComponentsWithStats(e2, connectivity=8)
        if n2 > 1:
            keep2 = st2[:, cv2.CC_STAT_AREA] >= a.fine_len * scale
            keep2[0] = False
            e2 = keep2[cc2].astype(np.uint8)
        e2[cv2.dilate((sky_mask > 0.3).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0] = 0
        thin = np.maximum(thin, cv2.GaussianBlur(e2.astype(np.float32), (0, 0), 0.55 * scale) * (1.6 * 0.55 * scale) * a.fine)
    # no ink down in the forest mass and on the snow: there it scribbles
    thin = np.clip(thin, 0, 1) * (1 - 0.9 * veg) * (1 - 0.6 * snow) * a.ink
    ink_c = hexrgb(P['ink'])
    out = out * (1 - thin[..., None]) + ink_c * thin[..., None]
    # dark contact under each ink line side: the shade the pen leaves in the gully
    ridge_i = np.zeros((H, W), np.float32)
    for x in range(W):
        ridge_i[min(H - 1, max(0, int(round(ridge[x])))), x] = 1
    # a column jumping several rows still has a closed line
    ridge_i = cv2.dilate(ridge_i, np.ones((3, 1), np.uint8))
    for x in range(1, W):
        y0, y1 = int(round(ridge[x - 1])), int(round(ridge[x]))
        if abs(y1 - y0) > 1:
            ridge_i[min(y0, y1):max(y0, y1) + 1, x] = 1
    ridge_l = np.clip(cv2.GaussianBlur(ridge_i, (0, 0), a.ridge_ink * scale) * (2.2 * a.ridge_ink * scale + 1.0), 0, 1)
    # the top edge of the land catches the light under the line, as in a painting
    rim = cv2.GaussianBlur(ridge_i, (0, 0), 7 * scale) * (1 - sky_mask)
    rim = np.clip(rim / (rim.max() + 1e-6), 0, 1)[..., None] * a.rim
    out = out * (1 - rim) + np.minimum(out * 1.25 + 0.05, 1) * rim

    # 6. Air: the land goes cool and pale toward its foot, and under the foot it is all mist.
    haze_c, mist_c = hexrgb(P['haze']), hexrgb(a.mist or P['mist'])
    wob = (fbm((H, W), 240 * scale, 7, 3) - 0.5) * 0.08
    yy = (np.arange(H, dtype=np.float32)[:, None] / H) + wob
    # measured from each column's own ridge: a low shoulder is as far from its foot as the summit is
    air = a.air * smoothstep(a.air_from, 1.0, rel + wob)
    out = out * (1 - air[..., None]) + haze_c * air[..., None]
    vair = (veg * a.veg_air)[..., None]
    out = out * (1 - vair) + mist_c * vair
    foot = smoothstep(a.foot - a.foot_soft, a.foot, yy)[..., None]
    out = out * (1 - foot) + mist_c * foot

    # The sky of the hour, row by row, with the even brush drift of a painted wash.
    sky_bottom = 0.0
    sky = row_sky(P, a, ridge, H, W)
    out = sky * sky_mask[..., None] + out * (1 - sky_mask[..., None])
    out = out * (1 - ridge_l[..., None] * a.ink_ridge) + ink_c * ridge_l[..., None] * a.ink_ridge

    # A last soft unification: the pen never lands as sharp as a filter does.
    out = cv2.GaussianBlur(out, (0, 0), 0.45 * scale)
    return np.clip(out, 0, 1), ridge, sky_bottom


def conifer_poly(x, y, h, w, jag):
    """A small conifer as a polygon, tip up: two tiers with a notch, so a mass of them reads as trees and not as triangles."""
    return np.array([[x, y - h], [x + w * 0.42, y - h * 0.46], [x + w * 0.2, y - h * 0.46 + jag], [x + w * 0.56, y], [x - w * 0.56, y], [x - w * 0.2, y - h * 0.46 + jag], [x - w * 0.42, y - h * 0.46]], dtype=np.int32)


def stamp_forest(out, mask, size, spruce, larch, larch_amt, light, sun_side=-1.0, seed=3, ink=None, tone=None, spacing=0.62):
    """Paints a forest one small tree at a time, far rows first, over `mask`. size: px per row (array by row or a float image).
    spruce, larch: rgb triples shade to light. larch_amt: image 0..1. light: image 0..1, how much sun this part of the slope has. tone: optional multiplier image."""
    H, W = mask.shape[:2]
    rng = np.random.default_rng(seed)
    sz = size if isinstance(size, np.ndarray) else np.full((H, W), float(size), np.float32)
    ys = []
    y = 0.0
    while y < H:
        ys.append(y)
        row = sz[int(y)]
        y += max(1.6, float(np.median(row[row > 0])) * spacing * 0.5 if (row > 0).any() else 3.0)
    for y in ys:
        iy = int(y)
        row = mask[iy]
        idx = np.nonzero(row > 0.5)[0]
        if idx.size == 0:
            continue
        step = max(2.0, float(np.median(sz[iy][idx])) * spacing)
        n = int(idx.size / step) + 1
        for x in rng.choice(idx, size=n, replace=False if n <= idx.size else True):
            s = float(sz[iy, x]) * (0.72 + 0.56 * rng.random())
            if s < 1.5:
                continue
            xx, yy, w = int(x), int(y + s * 0.3), s * 0.72
            la = float(larch_amt[iy, x]) > rng.random()
            ramp_c = larch if la else spruce
            li = float(np.clip(light[iy, x] + (rng.random() - 0.5) * 0.22, 0, 1))
            k = float(tone[iy, x]) if tone is not None else 1.0
            lo = ramp_c[0] * (1 - li) + ramp_c[1] * li
            hi = ramp_c[1] * (1 - li) + ramp_c[2] * li
            p = conifer_poly(xx, yy, s, w, s * 0.1)
            cv2.fillPoly(out, [p], (lo * k).tolist(), lineType=cv2.LINE_AA)
            # the sunny side of the tree, a plane of its own
            half = p.copy()
            side = float(sun_side[xx]) if isinstance(sun_side, np.ndarray) else sun_side
            half[:, 0] = np.where((half[:, 0] - xx) * side >= 0, half[:, 0], xx)
            cv2.fillPoly(out, [half], (hi * k).tolist(), lineType=cv2.LINE_AA)
    return out


def long_lines(edges, min_len):
    n, cc, st, _ = cv2.connectedComponentsWithStats(edges.astype(np.uint8), connectivity=8)
    if n <= 1:
        return edges.astype(np.uint8)
    keep = st[:, cv2.CC_STAT_AREA] >= min_len
    keep[0] = False
    return keep[cc].astype(np.uint8)


def strokes_only(lines, min_len, bend=1.8):
    """A network of cracks becomes separate pen strokes: junctions out, and only the pieces that run somewhere stay. A piece is kept if it is long, and not much longer along its path than across its bounding box: cracked mud winds, a gully runs."""
    m = lines.astype(np.uint8)
    nb = cv2.filter2D(m, -1, np.ones((3, 3), np.uint8), borderType=cv2.BORDER_CONSTANT)
    m[(nb >= 4) & (m > 0)] = 0
    n, cc, st, _ = cv2.connectedComponentsWithStats(m, connectivity=8)
    if n <= 1:
        return m
    reach = np.maximum(st[:, cv2.CC_STAT_WIDTH], st[:, cv2.CC_STAT_HEIGHT])
    keep = (reach >= min_len) & (st[:, cv2.CC_STAT_AREA] <= reach * bend)
    keep[0] = False
    return keep[cc].astype(np.uint8)


def creases(Y, sigma, thresh, min_len):
    """Thin lines along the dark creases of an image (gullies, ledges): the largest Hessian eigenvalue, kept where it peaks across its own direction. Returns lines 0/1 and strength."""
    g = cv2.GaussianBlur(Y.astype(np.float32), (0, 0), sigma)
    xx, yy, xy = cv2.Sobel(g, cv2.CV_32F, 2, 0, ksize=3), cv2.Sobel(g, cv2.CV_32F, 0, 2, ksize=3), cv2.Sobel(g, cv2.CV_32F, 1, 1, ksize=3)
    d = np.sqrt(((xx - yy) * 0.5) ** 2 + xy * xy)
    lam = (xx + yy) * 0.5 + d
    # the eigenvector of the large eigenvalue points across the crease
    vx, vy = lam - yy, xy
    n = np.sqrt(vx * vx + vy * vy) + 1e-7
    vx, vy = vx / n, vy / n
    H, W = Y.shape
    X, Yg = np.meshgrid(np.arange(W, dtype=np.float32), np.arange(H, dtype=np.float32))
    a = cv2.remap(lam, X + vx, Yg + vy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    b = cv2.remap(lam, X - vx, Yg - vy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    peak = (lam >= a) & (lam >= b)
    hi = peak & (lam > thresh)
    lo = peak & (lam > thresh * 0.45)
    # hysteresis, by component
    m, cc = cv2.connectedComponents(lo.astype(np.uint8), connectivity=8)
    keep = np.zeros(m, bool)
    keep[np.unique(cc[hi])] = True
    keep[0] = False
    return long_lines(keep[cc], min_len), lam


def cel(rgb, P, a):
    """Clean cel paint from a photo, the look of a hand repaint: mean shift gives flat shapes with crisp borders (no strokes, no flow: those melt rock into marble),
    a few hard tones per material, inked lines on the real breaks of the rock, bedding lines picked out where the rock has them, and forest painted tree by tree.
    Returns land rgb, sky mask (1 is sky), ridge row per column, forest mask."""
    H, W = rgb.shape[:2]
    scale = W / 2400.0
    ridge, sky_mask = find_sky(rgb, a.sky_top, a.land_from, a.cloud)
    land = sky_mask < 0.5
    # flat shapes first, in colour: that is what keeps the borders where the rock has them
    bgr8 = (rgb[:, :, ::-1] * 255).astype(np.uint8)
    # bilateral first takes the sensor noise and the fine gravel out cheaply; mean shift then flattens
    work = cv2.bilateralFilter(bgr8, 0, 22, 2.2 * scale)
    ms = cv2.pyrMeanShiftFiltering(work, max(4, a.cel_sp * scale), a.cel_sr, maxLevel=1)
    ms = cv2.medianBlur(ms, int(3 * scale) | 1)
    lab = cv2.cvtColor((ms[:, :, ::-1].astype(np.float32) / 255.0), cv2.COLOR_RGB2LAB)
    L, A, B = lab[:, :, 0] / 100.0, lab[:, :, 1], lab[:, :, 2]
    lab0 = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    # the blue of the shade and the cast of the hour must not read as colour: judge the land against its own mean
    nz = land & (L > 0.45)
    if nz.sum() > 500:
        A = A - float(np.median(A[nz]))
        B = B - float(np.median(B[nz]))
    rel = (np.arange(H, dtype=np.float32)[:, None] - ridge[None, :]) / (H - ridge[None, :] + 1e-3)
    # forest: dark and not the blue of a rock shadow, or plainly green, or plainly ochre low down
    green = smoothstep(1.5, 7, -A) * smoothstep(0.78, 0.5, L)
    dark = smoothstep(a.veg_dark + 0.06, a.veg_dark - 0.06, L) * smoothstep(-16, -4, B) * a.dark_veg
    ochre = smoothstep(9, 20, B) * smoothstep(0.82, 0.55, L) * smoothstep(0.0, 4.0, A + 2)
    # a mountain lit orange by the dawn is not an ochre forest
    if getattr(a, 'veg_no_ochre', False):
        ochre = ochre * 0
    veg = np.clip(green + dark + ochre + smoothstep(a.veg_any + 0.04, a.veg_any - 0.04, L), 0, 1) * smoothstep(a.veg_from - 0.06, a.veg_from + 0.08, rel)
    veg = cv2.GaussianBlur(veg.astype(np.float32), (0, 0), 3.5 * scale)
    veg = (veg > 0.5).astype(np.uint8)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(9 * scale) | 1, int(9 * scale) | 1))
    veg = cv2.morphologyEx(cv2.morphologyEx(veg, cv2.MORPH_OPEN, k), cv2.MORPH_CLOSE, k)
    n, cc, st, _ = cv2.connectedComponentsWithStats(veg, connectivity=8)
    if n > 1:
        big = st[:, cv2.CC_STAT_AREA] >= a.veg_min * scale * scale
        big[0] = False
        veg = big[cc].astype(np.uint8)
    veg = (veg > 0) & land
    # snow only where it is really white, and colourless
    chroma = np.sqrt(A * A + B * B)
    snow = (L > a.snow) & (chroma < 11) & land & ~veg
    snow = cv2.morphologyEx(snow.astype(np.uint8), cv2.MORPH_OPEN, np.ones((int(3 * scale) | 1, int(3 * scale) | 1), np.uint8)) > 0
    rock_px = land & ~veg & ~snow
    lo, hi = np.percentile(L[rock_px], [a.lo, a.hi]) if rock_px.sum() > 500 else (0.2, 0.9)
    # big planes, not flecks: the tones come from the rock with its small print taken out, only real changes of plane keep their border
    flat = np.clip(L, 0, 1).astype(np.float32)
    for _ in range(2):
        flat = cv2.bilateralFilter(flat, 0, a.cel_tone, a.cel_soft * scale)
    v = np.clip((flat - lo) / max(hi - lo, 1e-3), 0, 1).astype(np.float32)
    # auto exposure on the rock, then the broad masses lifted a little over the detail, as a painter does
    if rock_px.sum() > 500:
        med = float(np.median(np.clip(v[rock_px], 0.02, 1)))
        v = np.clip(v, 0, 1) ** (np.log(a.mid) / np.log(max(med, 0.02)) * a.gamma)
    broad = cv2.GaussianBlur(v, (0, 0), 24 * scale)
    v = np.clip(v + a.local * (v - broad), 0, 1)
    # hard tones, cleaned: a tone needs some area to exist, flecks melt into their neighbours
    n_t = a.tones
    idx = np.clip((v * n_t).astype(np.int32), 0, n_t - 1).astype(np.uint8)
    idx = cv2.medianBlur(idx, int(a.cel_clean * scale) | 1)
    t = (idx.astype(np.float32) + 0.5) / n_t
    # soft by a hair at the border of two tones: a brush, not a threshold
    t = cv2.GaussianBlur(t, (0, 0), 0.8 * scale)
    out = apply_ramp(t, ramp(P['rock']))
    # warmth from the hour high up, a cool cast in the shade low down: one light on the whole mountain
    warm = (P.get('warm', 0) * smoothstep(0.7, 0.05, rel) * smoothstep(0.3, 0.8, t))[..., None]
    out = out * (1 + warm * np.array([0.22, 0.03, -0.14], dtype=np.float32))
    # snow
    sv = np.clip((lab0[:, :, 0] / 100.0 - a.snow * 0.8) / (1 - a.snow * 0.8), 0, 1)
    sv = cv2.GaussianBlur(sv.astype(np.float32), (0, 0), 1.5 * scale)
    sn = cv2.GaussianBlur(snow.astype(np.float32), (0, 0), 0.7 * scale)[..., None]
    out = out * (1 - sn) + apply_ramp(posterise(sv, 3, soft=0.1), ramp(P['snow'])) * sn

    # 2. Ink. Long lines on the real breaks; thin; pressure from how strong the break is.
    src = cv2.GaussianBlur(flat, (0, 0), 1.6 * scale)
    gx, gy = cv2.Sobel(src, cv2.CV_32F, 1, 0, ksize=3), cv2.Sobel(src, cv2.CV_32F, 0, 1, ksize=3)
    mag = np.sqrt(gx * gx + gy * gy)
    e = cv2.Canny((src * 255).astype(np.uint8), int(a.ink_t * 0.5), int(a.ink_t), apertureSize=3, L2gradient=True)
    e = long_lines(e > 0, a.ink_len * scale)
    press = np.clip(mag / (np.percentile(mag[e > 0], 80) + 1e-6), 0.4, 1) if e.any() else 1.0
    ink = cv2.GaussianBlur(e.astype(np.float32) * press, (0, 0), a.pen * scale) * (2.5 * a.pen * scale)
    if a.crease > 0:
        # the gullies and the breaks of the rock, from the photo itself: these are what makes it read as drawn
        cl, lam = creases(lab0[:, :, 0] / 100.0, a.crease_s * scale, a.crease_t, a.crease_len * scale)
        pr = np.clip(lam / (np.percentile(lam[cl > 0], 70) + 1e-6), 0.3, 1) if cl.any() else 1.0
        ink = np.maximum(ink, cv2.GaussianBlur(cl.astype(np.float32) * pr, (0, 0), a.pen * 0.9 * scale) * (2.2 * a.pen * scale) * a.crease)
    if a.strata > 0:
        # bedding planes: thin near-horizontal dark lines, from a tall and narrow difference of the photo's own brightness. Long ones only: they cross whole faces.
        Y = cv2.GaussianBlur(lab0[:, :, 0] / 100.0, (int(15 * scale) | 1, int(3 * scale) | 1), 0)
        d2 = cv2.GaussianBlur(Y, (0, 0), 3.2 * scale) - Y
        lines = (d2 > a.strata_t) & rock_px
        lines = cv2.morphologyEx(lines.astype(np.uint8), cv2.MORPH_OPEN, np.ones((1, int(a.strata_len * 0.4 * scale) | 1), np.uint8))
        lines = long_lines(lines > 0, a.strata_len * scale)
        out = out * (1 - (cv2.GaussianBlur(lines.astype(np.float32), (0, 0), 0.7 * scale) * 0.34)[..., None]) + np.array(hexrgb(P['rock'][1][1]), np.float32) * (cv2.GaussianBlur(lines.astype(np.float32), (0, 0), 0.7 * scale) * 0.34)[..., None]
        ink = np.maximum(ink, cv2.GaussianBlur(lines.astype(np.float32), (0, 0), 0.5 * scale) * a.strata)
    ink = np.clip(ink, 0, 1) * (~veg) * (1 - 0.65 * sn[..., 0]) * a.ink
    ink[cv2.dilate((sky_mask > 0.3).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0] = 0
    ink_c = hexrgb(P['ink'])
    out = out * (1 - ink[..., None]) + ink_c * ink[..., None]

    # 3. The forest, tree by tree, in the photo's own distribution of spruce and larch, with a dark ground under it so that no rock shows through.
    if veg.any() and not a.no_trees:
        Lf = lab0[:, :, 0] / 100.0
        light = np.clip((cv2.GaussianBlur(Lf, (0, 0), 6 * scale) - np.percentile(Lf[veg], 8)) / max(np.percentile(Lf[veg], 92) - np.percentile(Lf[veg], 8), 1e-3), 0, 1).astype(np.float32)
        # the larches: warm in the photo, whatever the cast
        B0 = cv2.GaussianBlur(lab0[:, :, 2], (0, 0), 3 * scale)
        A0 = cv2.GaussianBlur(lab0[:, :, 1], (0, 0), 3 * scale)
        lar = smoothstep(a.larch_from, a.larch_from + 14, B0 + A0 * 0.6).astype(np.float32)
        spruce = np.stack([hexrgb(c) for c in P['spruce']])
        larch = np.stack([hexrgb(c) for c in P['larch']])
        vf = veg.astype(np.float32)
        ground = apply_ramp(light * 0.5, ramp(P['spruce']))
        out = out * (1 - vf[..., None]) + ground * vf[..., None]
        # trees on the edge of the forest stand on the rock: the mask reaches them there
        size = np.full((H, W), a.tree * scale, np.float32)
        out = stamp_forest(out, vf, size, spruce, larch, lar, light, sun_side=a.sun_side)

    # the ridge line
    ridge_i = np.zeros((H, W), np.float32)
    for x in range(W):
        ridge_i[min(H - 1, max(0, int(round(ridge[x])))), x] = 1
    for x in range(1, W):
        y0, y1 = int(round(ridge[x - 1])), int(round(ridge[x]))
        if abs(y1 - y0) > 1:
            ridge_i[min(y0, y1):max(y0, y1) + 1, x] = 1
    ridge_l = np.clip(cv2.GaussianBlur(ridge_i, (0, 0), a.ridge_ink * scale) * (2.2 * a.ridge_ink * scale + 1.0), 0, 1)
    out = out * (1 - ridge_l[..., None] * a.ink_ridge) + ink_c * ridge_l[..., None] * a.ink_ridge
    if a.air > 0:
        air = a.air * smoothstep(a.air_from, 1.0, rel)[..., None]
        out = out * (1 - air) + hexrgb(P['haze']) * air
    return np.clip(out, 0, 1).astype(np.float32), sky_mask, ridge, veg.astype(np.float32)


def illustrate(rgb, P, a):
    """An ink and wash illustration from a photo, to stand beside a hand repaint: soft tones in big planes (no hard posterise: on a low contrast face it makes camouflage), the evening's rose ramp, thin tapered lines on
    the real gullies and ledges only, a teal air toward the foot, and the photo's own forest as a dark wash with tree tips. Same return as cel()."""
    H, W = rgb.shape[:2]
    scale = W / 2400.0
    ridge, sky_mask = find_sky(rgb, a.sky_top, a.land_from, a.cloud)
    # a ridge traced by eye (a.ridge_given, recipe `hint_wins`): smoke or a far wall behind the mountain is not the mountain
    if getattr(a, 'ridge_given', None) is not None:
        ridge = a.ridge_given
        sky_mask = (np.arange(H, dtype=np.float32)[:, None] < ridge[None, :]).astype(np.float32)
    land = sky_mask < 0.5
    lab0 = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    bgr8 = (rgb[:, :, ::-1] * 255).astype(np.uint8)
    ms = cv2.pyrMeanShiftFiltering(cv2.bilateralFilter(bgr8, 0, 20, 2.0 * scale), max(4, a.cel_sp * scale), a.cel_sr, maxLevel=1)
    lab = cv2.cvtColor((ms[:, :, ::-1].astype(np.float32) / 255.0), cv2.COLOR_RGB2LAB)
    L, A, B = lab[:, :, 0] / 100.0, lab[:, :, 1], lab[:, :, 2]
    nz = land & (L > 0.45)
    if nz.sum() > 500:
        A = A - float(np.median(A[nz]))
        B = B - float(np.median(B[nz]))
    rel = (np.arange(H, dtype=np.float32)[:, None] - ridge[None, :]) / (H - ridge[None, :] + 1e-3)
    green = smoothstep(1.5, 7, -A) * smoothstep(0.78, 0.5, L)
    dark = smoothstep(a.veg_dark + 0.06, a.veg_dark - 0.06, L) * smoothstep(-16, -4, B) * a.dark_veg
    ochre = smoothstep(9, 20, B) * smoothstep(0.82, 0.55, L) * smoothstep(0.0, 4.0, A + 2)
    # a mountain lit orange by the dawn is not an ochre forest
    if getattr(a, 'veg_no_ochre', False):
        ochre = ochre * 0
    veg = np.clip(green + dark + ochre + smoothstep(a.veg_any + 0.04, a.veg_any - 0.04, L), 0, 1) * smoothstep(a.veg_from - 0.06, a.veg_from + 0.08, rel)
    veg = (cv2.GaussianBlur(veg.astype(np.float32), (0, 0), 3.5 * scale) > 0.5).astype(np.uint8)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(9 * scale) | 1, int(9 * scale) | 1))
    veg = cv2.morphologyEx(cv2.morphologyEx(veg, cv2.MORPH_OPEN, k), cv2.MORPH_CLOSE, k)
    n, cc, st, _ = cv2.connectedComponentsWithStats(veg, connectivity=8)
    if n > 1:
        big = st[:, cv2.CC_STAT_AREA] >= a.veg_min * scale * scale
        big[0] = False
        veg = big[cc].astype(np.uint8)
    veg = (veg > 0) & land
    # veg_top_only: no forest above the line traced in the recipe's veg_hint
    if getattr(a, 'veg_top_only', False) and a.veg_top is not None:
        veg = veg & (np.arange(H, dtype=np.float32)[:, None] >= a.veg_top[None, :])
    rock_px = land & ~veg
    lo, hi = np.percentile(L[rock_px], [a.lo, a.hi]) if rock_px.sum() > 500 else (0.2, 0.9)
    # planes that run with the rock: the photo smoothed along its own grain (bedding, gullies) and pushed apart across it, so shapes are long and angular like brush strokes, never round blobs
    flat = cv2.GaussianBlur(np.clip(lab0[:, :, 0] / 100.0, 0, 1).astype(np.float32), (0, 0), 0.9 * scale)
    flat = flat * (1 - sky_mask) + float(np.median(flat[land])) * sky_mask
    for _ in range(a.strokes):
        tx, ty, _coh = flow(flat, 1.4 * scale, a.grain_s * scale)
        flat = lic(flat, tx, ty, steps=max(4, int(a.grain_len * scale)), h=1.0)
    flat = shock(flat, iters=a.shock, dt=0.3, sigma=max(1.0, 1.3 * scale))
    flat = cv2.bilateralFilter(flat, 0, a.cel_tone, a.cel_soft * scale)
    v = np.clip((flat - lo) / max(hi - lo, 1e-3), 0, 1).astype(np.float32)
    if rock_px.sum() > 500:
        med = float(np.median(np.clip(v[rock_px], 0.02, 1)))
        v = np.clip(v, 0, 1) ** (np.log(a.mid) / np.log(max(med, 0.02)) * a.gamma)
    broad = cv2.GaussianBlur(v, (0, 0), 30 * scale)
    v = np.clip(v + a.local * (v - broad), 0, 1)
    # a gentle step: tones gather without a contour you can count
    v = v * (1 - a.step) + posterise(v, a.tones, soft=a.soft) * a.step
    v = cv2.GaussianBlur(v, (0, 0), 0.7 * scale)
    # snow is rock in this season: the brightest stays a cream ledge, never paper white
    v = np.minimum(v, a.v_max)
    out = apply_ramp(v, ramp(P['rock_i']))
    # high rock warm, lower rock cooling toward its foot: one light on the whole mountain
    warm = (smoothstep(0.55, 0.0, rel) * smoothstep(0.35, 0.8, v))[..., None]
    out = out * (1 + warm * np.array([0.05, -0.01, -0.05], dtype=np.float32))
    # ink: separate pen strokes on the real gullies and breaks, tapered by how deep they are
    cl, lam = creases(cv2.GaussianBlur(lab0[:, :, 0] / 100.0, (0, 0), 1.0 * scale), a.crease_s * scale, a.crease_t, a.crease_len * 0.5 * scale)
    cl = strokes_only(cl, a.crease_len * scale, a.bend)
    pr = np.clip(lam / (np.percentile(lam[cl > 0], 70) + 1e-6), 0.3, 1) if cl.any() else 1.0
    ink = cv2.GaussianBlur(cl.astype(np.float32) * pr, (0, 0), a.pen * scale) * (2.4 * a.pen * scale) * a.crease
    if a.strata > 0:
        Y = cv2.GaussianBlur(lab0[:, :, 0] / 100.0, (int(15 * scale) | 1, int(3 * scale) | 1), 0)
        d2 = cv2.GaussianBlur(Y, (0, 0), 3.2 * scale) - Y
        lines = cv2.morphologyEx(((d2 > a.strata_t) & rock_px).astype(np.uint8), cv2.MORPH_OPEN, np.ones((1, int(a.strata_len * 0.4 * scale) | 1), np.uint8))
        lines = long_lines(lines > 0, a.strata_len * scale)
        sl = cv2.GaussianBlur(lines.astype(np.float32), (0, 0), 1.1 * scale)[..., None] * 0.28
        out = out * (1 - sl) + hexrgb(P['rock_i'][1][1]) * sl
        ink = np.maximum(ink, cv2.GaussianBlur(lines.astype(np.float32), (0, 0), 0.5 * scale) * a.strata)
    # the pen lifts as the air thickens
    ink = np.clip(ink, 0, 1) * (~veg) * a.ink * (1 - 0.6 * smoothstep(0.35, 0.8, rel))
    ink[cv2.dilate((sky_mask > 0.3).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0] = 0
    ink_c = hexrgb(P['ink'])
    out = out * (1 - ink[..., None]) + ink_c * ink[..., None]
    # the forest: a dark wash with gold through it and tree tips along its top
    if veg.any():
        vf = cv2.GaussianBlur(veg.astype(np.float32), (0, 0), 1.2 * scale)
        Lf = lab0[:, :, 0] / 100.0
        light = np.clip((cv2.GaussianBlur(Lf, (0, 0), 7 * scale) - np.percentile(Lf[veg], 8)) / max(np.percentile(Lf[veg], 92) - np.percentile(Lf[veg], 8), 1e-3), 0, 1).astype(np.float32)
        ground = apply_ramp(light * 0.7, ramp(P['forest_i']))
        out = out * (1 - vf[..., None]) + ground * vf[..., None]
        if not a.no_trees:
            spruce, larch = np.stack([hexrgb(c) for c in P['forest_i']]), np.stack([hexrgb(c) for c in P['larch_i']])
            lar = (0.1 + 0.22 * smoothstep(0.45, 0.7, fbm((H, W), 40 * scale, 31, 2))).astype(np.float32)
            stamp_forest(out, vf, np.full((H, W), a.tree * scale, np.float32), spruce, larch, lar, light, sun_side=a.sun_side)
    # the ridge line, thin
    ridge_i = np.zeros((H, W), np.float32)
    for x in range(W):
        ridge_i[min(H - 1, max(0, int(round(ridge[x])))), x] = 1
    for x in range(1, W):
        y0, y1 = int(round(ridge[x - 1])), int(round(ridge[x]))
        if abs(y1 - y0) > 1:
            ridge_i[min(y0, y1):max(y0, y1) + 1, x] = 1
    ridge_l = np.clip(cv2.GaussianBlur(ridge_i, (0, 0), a.ridge_ink * scale) * (2.2 * a.ridge_ink * scale + 1.0), 0, 1)
    out = out * (1 - ridge_l[..., None] * a.ink_ridge) + ink_c * ridge_l[..., None] * a.ink_ridge
    # the air at its foot
    if a.foot_air > 0:
        air = (a.foot_air * smoothstep(a.air_from, 1.0, rel))[..., None]
        out = out * (1 - air) + hexrgb(P['foot_air']) * air
    return np.clip(out, 0, 1).astype(np.float32), sky_mask, ridge, veg.astype(np.float32)


def ridge_from_hint(rgb, hint, win=0.012):
    """The ridge of a photo whose sky fools the finder (thin cloud, pale rock), from a line traced by eye: hint is [[u, row], ...] in fractions of the image; each column takes the sharpest step within win of it."""
    H, W = rgb.shape[:2]
    us, rows = zip(*hint)
    guess = np.interp((np.arange(W, dtype=np.float32) + 0.5) / W, us, rows) * H
    lab = cv2.GaussianBlur(cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB), (0, 0), 1.0)
    w = max(3, int(win * W))
    ridge = np.zeros(W, np.float32)
    for x in range(W):
        y0, y1 = max(0, int(guess[x]) - w), min(H - 2, int(guess[x]) + w)
        col = lab[y0:y1 + 1, x]
        # the first row that has left the sky: halfway from the colour at the top of the window to the land under it
        sky_c, land_c = col[:4].mean(axis=0), col[-6:].mean(axis=0)
        ax = land_c - sky_c
        t = ((col - sky_c) @ ax) / max(float(ax @ ax), 1e-3)
        over = np.nonzero(t > 0.5)[0]
        ridge[x] = y0 + (int(over[0]) if over.size else w)
    ridge = cv2.medianBlur(cv2.medianBlur(ridge.reshape(1, -1), 5), 5)[0]
    return cv2.GaussianBlur(ridge.reshape(1, -1), (0, 0), 1.0)[0]


def planes(rgb, P, a, ridge=None):
    """The one hand every mountain of a panorama is painted by: the photo read along the grain of its rock, cut at a few tones into flat angular shapes with thin pen on the edges of the deep shade. Flat shapes keep the rock of a photo from going waxy, and they are what a hand inked illustration is made of.
    px sizes hold at 45 px per degree, a.plane_px scales them. Returns land, sky mask, ridge, forest mask."""
    H, W = rgb.shape[:2]
    k = a.plane_px
    if ridge is None:
        ridge, _ = find_sky(rgb, a.sky_top, a.land_from, a.cloud)
    Y = np.arange(H, dtype=np.float32)[:, None]
    sky = np.clip(ridge[None, :] + 1 - Y, 0, 1).astype(np.float32)
    land = sky < 0.5
    L = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)[..., 0] / 100.0
    flat = cv2.GaussianBlur(L, (0, 0), 1.5 * k)
    flat = flat * (1 - sky) + float(np.median(flat[land])) * sky
    if getattr(a, 'plane_keep', None):
        flat = keep_read(L, land, a.plane_keep, k)
    elif a.plane_bed:
        flat = bed_read(L, land, a.plane_bed, k)
    else:
        tx, ty, _ = flow(flat, 2.0 * k, a.grain_s * k)
        flat = lic(flat, tx, ty, steps=max(4, int(a.grain_len * k)), h=1.0)
    v = flat + a.plane_local * (flat - cv2.GaussianBlur(flat, (0, 0), 90 * k))
    rock = land & (L > a.veg_any)
    lo, hi = np.percentile(v[rock], [a.lo, a.hi])
    v = np.clip((v - lo) / max(hi - lo, 1e-3), 0, 1)
    if a.mid > 0:
        med = float(np.median(np.clip(v[rock], 0.02, 0.98)))
        v = v ** (np.log(a.mid) / np.log(med))
    s = cv2.GaussianBlur(v, (0, 0), a.plane_sm * k)
    rr = ramp(P['rock_i'])
    col = lambda t: apply_ramp(np.array([[t]], np.float32), rr)[0, 0]
    cuts, tones = a.plane_cuts, a.plane_tones
    out = np.ones((H, W, 3), np.float32) * col(tones[0])
    layers = []
    for i, t in enumerate(cuts):
        cs, hi_ = cv2.findContours((s > t).astype(np.uint8), cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
        if hi_ is None:
            layers.append([])
            continue
        polys = [cv2.approxPolyDP(c, a.plane_eps * k, True) for c in cs if cv2.contourArea(c) >= a.plane_min * k * k]
        lay = np.zeros((H, W), np.uint8)
        cv2.fillPoly(lay, polys, 255, lineType=cv2.LINE_AA)
        al = (lay.astype(np.float32) / 255)[..., None]
        out = out * (1 - al) + col(tones[i + 1]) * al
        layers.append(polys)
    if a.plane_green:
        out = plane_jungle(out, rgb, v, P, a, k)
    if a.plane_grass:
        out = plane_alpine(out, rgb, layers, P, a, k)
    # plane_soft: the flat shapes melt toward the continuous tone under them, plane_detail lays the photo's own fine rock back over them. Default 0, as flat as ever: a night mountain with no direct light reads as camouflage when it is all hard shapes
    if getattr(a, 'plane_soft', 0) > 0:
        cont = apply_ramp(np.interp(s, [0.0, *cuts, 1.0], [tones[0], *[(tones[i] + tones[i + 1]) / 2 for i in range(len(cuts))], tones[-1]]).astype(np.float32), rr)
        out = out * (1 - a.plane_soft) + cont * a.plane_soft
    if getattr(a, 'plane_detail', 0) > 0:
        fine = L - cv2.GaussianBlur(L, (0, 0), 5 * k)
        out = out * (1 + a.plane_detail * np.clip(fine, -0.25, 0.25)[..., None])
    # the light across the whole face, broad only: a fine one would bevel each shape into wax
    out = out * (1 + a.plane_wash * (cv2.GaussianBlur(v, (0, 0), 26 * k) - 0.5)[..., None])
    if a.plane_bed:
        out = bed_paint(out, L, land, ridge, P, a.plane_bed, k)
    if getattr(a, 'plane_keep', None):
        out = keep_tint(out, rgb, L, land, v, ridge, a.plane_keep, k)
    # strata: bedding drawn as a thin dark line, for rock whose ledges are its face
    ink = np.zeros((H, W), np.float32)
    rng = np.random.default_rng(3)
    for i in a.plane_pen:
        for p in layers[i]:
            q = p[:, 0, :]
            n = len(q)
            if n < 4 or cv2.arcLength(p, True) < 120 * k:
                continue
            j = int(rng.integers(0, 3))
            while j < n - 1:
                e = min(n, j + int(rng.integers(2, 7)))
                cv2.polylines(ink, [q[j:e]], False, 0.85 if i == 0 else 0.55, 1, cv2.LINE_AA)
                j = e - 1 + int(rng.integers(0, 2)) * int(rng.integers(1, 3))
    # and the long gullies on the lit faces, one stroke each
    if a.plane_gully > 0:
        cl, _ = creases(cv2.GaussianBlur(L, (0, 0), 1.0 * k), 2.4 * k, 0.012, 60 * k)
        cl = strokes_only(cl, 90 * k, 1.6)
        ink = np.maximum(ink, cl.astype(np.float32) * a.plane_gully)
    ink = np.clip(cv2.GaussianBlur(ink, (0, 0), 0.6) * 1.2, 0, 1) * land
    out = out * (1 - ink[..., None]) + hexrgb(P['ink']) * ink[..., None]
    # the forest: the deep shade that reaches the foot, under a line traced by eye or a share of the height. The composer paints it, so that all forest is one forest
    veg = s < a.veg_cut
    if a.veg_top is not None:
        top = a.veg_top
    elif a.veg_hint:
        us, rows = zip(*a.veg_hint)
        top = np.interp((np.arange(W, dtype=np.float32) + 0.5) / W, us, rows) * H
    else:
        top = ridge + (H - ridge) * a.veg_from
    veg = veg & (Y >= top[None, :])
    # a.veg_force, a row per column: under it all is forest, however lit
    if a.veg_force is not None:
        veg = veg | (Y >= a.veg_force[None, :])
    veg = (veg & land).astype(np.uint8)
    e = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(7 * k) | 1, int(7 * k) | 1))
    # small flecks of rock in the wood close up: left, they read as camouflage; the long gullies stay
    e2 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(19 * k) | 1, int(19 * k) | 1))
    veg = cv2.morphologyEx(cv2.morphologyEx(veg, cv2.MORPH_OPEN, e), cv2.MORPH_CLOSE, e2)
    n, cc, st, _ = cv2.connectedComponentsWithStats(veg, connectivity=8)
    if n > 1:
        big = st[:, cv2.CC_STAT_AREA] >= a.veg_min * k * k
        big[0] = False
        veg = big[cc]
    return np.clip(out, 0, 1).astype(np.float32), sky, ridge, veg.astype(np.float32)


def keep_read(L, land, K, k):
    """plane_keep { sc, ss, passes }: the rock read with an edge keeping filter and no grain at all, so the ledges stay short and broken and the gullies stay cut across them. A filter along the grain makes a bedded face into marble."""
    w = land.astype(np.float32)
    x = (L * w + float(np.median(L[land])) * (1 - w)).astype(np.float32)
    for _ in range(int(K.get('passes', 2))):
        x = cv2.bilateralFilter(x, -1, K.get('sc', 0.09), K.get('ss', 1.6) * k)
    return x


def keep_tint(out, rgb, L, land, v, ridge, K, k):
    """The colour of the rock, from the photo and not from a rule: where the photo's rock is warm the paint goes pale cream, its shade and its snow stay cold. The hour on top: the glow only on lit rock high up, so that it needs and keeps a cold flank. plane_keep { warm, warm_amt, foot, glow, glow_amt, cold, cold_amt }."""
    H, W = L.shape
    Y = np.arange(H, dtype=np.float32)[:, None]
    b = cv2.GaussianBlur(cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)[..., 2], (0, 0), 1.0 * k)
    n, top = np.percentile(b[land], [K.get('warm_from', 45), 96])
    warm = smoothstep(float(n), float(max(top, n + 1)), b)[..., None] * K.get('warm_amt', 0.6)
    out = out * (1 - warm) + out * hexrgb(K.get('warm', '#f0d2ac')) * 1.04 * warm
    foot = K.get('foot', 0.8) * H
    h = np.clip((Y - ridge[None, :]) / np.maximum(foot - ridge[None, :], 8.0), 0, 1).astype(np.float32)
    lit = smoothstep(K.get('lit_from', 0.2), K.get('lit_to', 0.55), v)
    glow = ((1 - smoothstep(K.get('glow_from', 0.02), K.get('glow_to', 0.62), h)) * lit)[..., None] * K.get('glow_amt', 0.5)
    out = out * (1 - glow) + out * hexrgb(K.get('glow', '#ffc8a8')) * 1.1 * glow
    cold = smoothstep(K.get('cold_from', 0.4), K.get('cold_to', 1.0), h)[..., None] * K.get('cold_amt', 0.5)
    out = out * (1 - cold) + out * hexrgb(K.get('cold', '#a4b4ec')) * cold
    return out


def bed_shear(W, dip):
    """The row offset per column that lays a bed flat: dip in degrees, + rises to the right, one figure or [[u, deg], ...]. A bed then lies along one row, so everything below works along rows and comes out dead straight."""
    if isinstance(dip, (list, tuple)):
        us, ds = zip(*dip)
        d = np.interp((np.arange(W, dtype=np.float32) + 0.5) / W, us, ds)
    else:
        d = np.full(W, float(dip), np.float32)
    c = np.cumsum(np.tan(np.radians(d))).astype(np.float32)
    return c - c[W // 2]


def bed_lay(x, c, back=False, value=0.0):
    H, W = x.shape[:2]
    Y = np.arange(H, dtype=np.float32)[:, None] + (c[None, :] if back else -c[None, :])
    X = np.tile(np.arange(W, dtype=np.float32)[None, :], (H, 1))
    return cv2.remap(x, X, Y.astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=value)


def bed_read(L, land, B, k):
    """plane_bed { tensor, run, fine }: the rock read along a direction measured over a wide window (tensor, px), so the stroke stays straight where the small grain would curl it into a swirl. The ledges of the photo are straight already: this only must not bend them."""
    w = land.astype(np.float32)
    med = float(np.median(L[land]))
    base = L * w + med * (1 - w)
    tx, ty, _ = flow(base, 2.0 * k, B.get('tensor', 40) * k)
    fine = cv2.GaussianBlur(base, (0, 0), B.get('fine', 0.8) * k)
    return lic(fine, tx, ty, steps=max(3, int(B.get('run', 9) * k)), h=1.0)


def bed_paint(out, L, land, ridge, P, B, k):
    """What makes bedded dolomite read: beds of ochre and grey in turn, the light of the hour high on the walls and the cold of the valley low, and thin dead straight ledges of snow, each with a dark line of shade under it. plane_bed { ochre, grey, tint, glow, cold, foot (row of the foot, 0..1), snow, ledge_t, ledge_min, ledge_max }."""
    H, W = L.shape
    w = land.astype(np.float32)
    c = bed_shear(W, B['dip'])
    Y = np.arange(H, dtype=np.float32)[:, None]
    rng = np.random.default_rng(B.get('seed', 5))
    # beds: a colour per row of the laid out rock, in three sizes; they break a little along their length
    pad = H + int(np.abs(c).max()) + 8
    n = np.zeros((1, pad * 2), np.float32)
    for s, g in ((3.0 * k, 0.35), (9.0 * k, 0.4), (28.0 * k, 0.5)):
        q = cv2.GaussianBlur(rng.standard_normal((1, pad * 2)).astype(np.float32), (0, 0), s)
        n += g * q / max(float(q.std()), 1e-4)
    row = np.clip(Y + c[None, :] + pad // 2, 0, pad * 2 - 1).astype(np.int32)
    drift = cv2.GaussianBlur(rng.standard_normal((H, W)).astype(np.float32), (0, 0), 60 * k)
    tb = np.clip(0.5 + 0.5 * n[0][row] + 0.25 * drift / max(float(drift.std()), 1e-4), 0, 1)
    och, gry = hexrgb(B.get('ochre', '#e8b47c')), hexrgb(B.get('grey', '#a8a8bc'))
    tint = och * tb[..., None] + gry * (1 - tb[..., None])
    a_t = B.get('tint', 0.42)
    grey = out.mean(axis=2, keepdims=True)
    painted = grey * tint / max(float(tint.mean()), 1e-3)
    out = out * (1 - a_t) + painted * a_t
    # the hour: alpenglow on the upper walls, blue in the lower
    foot = B.get('foot', 0.75) * H
    h = np.clip((Y - ridge[None, :]) / np.maximum(foot - ridge[None, :], 8.0), 0, 1).astype(np.float32)
    glow = (1 - smoothstep(0.05, 0.55, h))[..., None] * B.get('glow_amt', 0.4)
    cold = smoothstep(0.42, 0.95, h)[..., None] * B.get('cold_amt', 0.55)
    out = out * (1 - glow) + out * hexrgb(B.get('glow', '#ffc6a0')) * 1.18 * glow
    out = out * (1 - cold) + out * hexrgb(B.get('cold', '#8fa4e0')) * cold
    # the ledges, with the beds laid flat: each bright run along a row of at least ledge_open px is a ledge, and gets one straight stroke
    base = cv2.GaussianBlur(L, (0, 0), 0.7 * k)
    sy = B.get('ledge_sy', 3.5) * k
    top = bed_lay((base - cv2.GaussianBlur(base, (0, 0), sy)) * w, c)
    mask = (top > B.get('ledge_t', 0.02)).astype(np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (max(3, int(B.get('ledge_open', 22) * k)) | 1, 1)))
    num, cc, st, cen = cv2.connectedComponentsWithStats(mask, connectivity=8)
    snow, shade = np.zeros((H, W), np.float32), np.zeros((H, W), np.float32)
    mn, mx = B.get('ledge_min', 34) * k, B.get('ledge_max', 2.0) * k
    S = 8
    for i in range(1, num):
        x0, y0, wd, hg, area = st[i]
        if wd < mn or hg > B.get('ledge_hg', 14) * k:
            continue
        ym = float(cen[i][1])
        th = min(mx, max(0.8 * k, 0.5 * area / wd))
        m = max(8, int(wd) // 8)
        xs = np.linspace(x0, x0 + wd, m)
        prof = np.sin(np.linspace(0.0, np.pi, m)) ** 0.45 * th
        up = np.stack([xs, ym - prof * 0.5], 1)
        dn = np.stack([xs, ym + prof * 0.5], 1)[::-1]
        cv2.fillPoly(snow, [np.round(np.concatenate([up, dn]) * S).astype(np.int32)], 1.0, cv2.LINE_AA, 3)
        up2 = np.stack([xs, ym + prof * 0.5], 1)
        dn2 = np.stack([xs, ym + prof * 0.5 + th * 0.9 + 0.8 * k], 1)[::-1]
        cv2.fillPoly(shade, [np.round(np.concatenate([up2, dn2]) * S).astype(np.int32)], 1.0, cv2.LINE_AA, 3)
    snow, shade = bed_lay(snow, c, back=True) * w, bed_lay(shade, c, back=True) * w
    ink = hexrgb(P['ink'])
    a_sh = (shade * (1 - snow) * B.get('shade_amt', 0.42))[..., None]
    out = out * (1 - a_sh) + (out * 0.55 + ink * 0.45) * a_sh
    warm, cool = hexrgb(B.get('snow_lit', '#fff0e4')), hexrgb(B.get('snow_cold', '#c3cff0'))
    sc = warm * (1 - h[..., None]) + cool * h[..., None]
    a_sn = (snow * B.get('snow', 0.95))[..., None]
    return out * (1 - a_sn) + sc * a_sn


def plane_alpine(out, rgb, layers, P, a, k):
    """a.plane_grass { lo, hi: how green the photo must be to count, in Lab -a after its median; sm: px of the shapes }: open grass over the rock, as on a repaint of a treeless mountain: the same flat tones, in the grass ramp where the photo is green or ochre, and the rock's rose only where it is bare. Same cuts, so the shapes stay one drawing."""
    G, H, W = a.plane_grass, rgb.shape[0], rgb.shape[1]
    rr = ramp(P['grass_i'])
    col = lambda t: apply_ramp(np.array([[t]], np.float32), rr)[0, 0]
    lift = G.get('lift', 0.0)
    g = np.ones((H, W, 3), np.float32) * col(min(1, a.plane_tones[0] + lift))
    for i, polys in enumerate(layers):
        lay = np.zeros((H, W), np.uint8)
        cv2.fillPoly(lay, polys, 255, lineType=cv2.LINE_AA)
        al = (lay.astype(np.float32) / 255)[..., None]
        g = g * (1 - al) + col(min(1, a.plane_tones[i + 1] + lift)) * al
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    A, Bb = cv2.GaussianBlur(lab[..., 1], (0, 0), G.get('sm', 5) * k), cv2.GaussianBlur(lab[..., 2], (0, 0), G.get('sm', 5) * k)
    green = np.clip(-A + G.get('b', 0.35) * Bb, -40, 40)
    # rock in shade or mist has no colour to read: the median of the land is the neutral point
    m = smoothstep(G.get('lo', 2.0), G.get('hi', 5.0), green)
    mask = (m > 0.5).astype(np.uint8)
    cs, _ = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    polys = [cv2.approxPolyDP(c, a.plane_eps * k, True) for c in cs if cv2.contourArea(c) >= G.get('min', a.plane_min) * k * k]
    lay = np.zeros((H, W), np.uint8)
    cv2.fillPoly(lay, polys, 255, lineType=cv2.LINE_AA)
    al = (lay.astype(np.float32) / 255)[..., None]
    return out * (1 - al) + g * al


def plane_jungle(out, rgb, v, P, a, k):
    """a.plane_green { line: [[u, row], ...] traced on the photo: under it the mountain is jungle; sm, cuts, tones: its own big soft shapes in the green ramp; crown: px of a tree at the top and at the foot }. Bare lava above the line keeps the rock's paint. A jungle in rock's fine shapes reads as camouflage: here the broad light of the spurs and gullies, and a canopy of small round crowns."""
    G, H, W = a.plane_green, rgb.shape[0], rgb.shape[1]
    us, rows = zip(*G['line'])
    top = np.interp((np.arange(W, dtype=np.float32) + 0.5) / W, us, rows) * H
    # the edge of the wood is ragged, tongues of forest up the gullies
    rng = np.random.default_rng(11)
    wob = cv2.GaussianBlur(rng.random((1, W), dtype=np.float32) - 0.5, (0, 0), 7 * k)[0]
    wob = wob / max(float(np.abs(wob).max()), 1e-3) * G.get('rag', 10) * k
    Y = np.arange(H, dtype=np.float32)[:, None]
    g = np.clip((Y - (top + wob)[None, :]) / 1.5, 0, 1).astype(np.float32)
    gr = ramp(P['green_i'])
    col = lambda t: apply_ramp(np.array([[t]], np.float32), gr)[0, 0]
    s2 = cv2.GaussianBlur(v, (0, 0), G.get('sm', 4) * k)
    lo, hi = np.percentile(s2[g > 0.5], [3, 97])
    s2 = np.clip((s2 - lo) / max(hi - lo, 1e-3), 0, 1)
    # fade: [row0, row1, tone]: what the photo shows low down (a bank of cloud) is not the slope: its tone goes to this one between those rows. Default none
    if G.get('fade'):
        f0, f1, ft = G['fade'][:3]
        ff = np.clip((Y / H - f0) / max(f1 - f0, 1e-3), 0, 1).astype(np.float32)
        nn = cv2.GaussianBlur(rng.random((H, W), dtype=np.float32), (0, 0), 14 * k)
        # with a point [.., u, row]: spurs and gullies running straight down from it, as on a cone, not blotches
        if len(G['fade']) > 3:
            th = np.arctan2(np.arange(W, dtype=np.float32)[None, :] - G['fade'][3] * W, Y - G['fade'][4] * H + 1)
            spur = sum(np.interp(th, np.linspace(-1.7, 1.7, q), rng.random(q)) * wt for q, wt in ((70, 1.0), (170, 0.6), (420, 0.3))).astype(np.float32)
            nn = spur + 0.25 * (nn - nn.mean()) / max(float(nn.std()), 1e-3) * float(spur.std())
        nn = (nn - nn.mean()) / max(float(nn.std()), 1e-3)
        s2 = s2 * (1 - ff) + np.clip(ft + 0.16 * nn, 0, 1) * ff
    # tongue: { line: [[u, row], ...], cut }: between `line` and this higher line the wood climbs only where the photo is dark, up the ribs between the lava channels, thinning to nothing. Default none: one treeline
    if G.get('tongue'):
        Tg = G['tongue']
        tu, tr = zip(*Tg['line'])
        up = np.interp((np.arange(W, dtype=np.float32) + 0.5) / W, tu, tr) * H
        band = np.clip((Y - up[None, :]) / np.maximum((top - up)[None, :], 1), 0, 1).astype(np.float32)
        fine = cv2.GaussianBlur(v, (0, 0), Tg.get('sm', 2.2) * k)
        fine = np.clip(0.5 + Tg.get('local', 2.4) * (fine - cv2.GaussianBlur(fine, (0, 0), 16 * k)), 0, 1)
        grow = ((fine < band * Tg.get('cut', 1.1) - 0.1) & (band > 0)).astype(np.uint8)
        grow = cv2.morphologyEx(grow, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(3 * k) | 1, int(3 * k) | 1)))
        g = np.maximum(g, cv2.GaussianBlur(grow.astype(np.float32), (0, 0), 0.7 * k))
        top = np.minimum(top, up)  # the canopy goes up the tongues too, or its first row is a ruled line
    green = np.ones((H, W, 3), np.float32) * col(G['tones'][0])
    for i, t in enumerate(G['cuts']):
        cs, _ = cv2.findContours((s2 > t).astype(np.uint8), cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE)
        polys = [cv2.approxPolyDP(c, a.plane_eps * k, True) for c in cs if cv2.contourArea(c) >= G.get('min', 200) * k * k]
        lay = np.zeros((H, W), np.uint8)
        cv2.fillPoly(lay, polys, 255, lineType=cv2.LINE_AA)
        al = cv2.GaussianBlur(lay.astype(np.float32) / 255, (0, 0), 0.8 * k)[..., None]
        green = green * (1 - al) + col(G['tones'][i + 1]) * al
    # the canopy, far rows first, each crown the colour of the slope it stands on
    c0, c1 = G.get('crown', [2.5, 6])
    y = float(np.min(top))
    while y < H - 1:
        iy = int(y)
        f = smoothstep(0.0, 1.0, np.clip((y - np.median(top)) / max(H - np.median(top), 1), 0, 1))
        s_ = (c0 + (c1 - c0) * float(f)) * k
        n = int(W / max(1.6, s_ * 1.1))
        for x in rng.integers(0, W, n):
            if iy < top[x]:
                continue
            c = green[iy, x] * (0.95 + 0.1 * rng.random())
            r = s_ * (0.7 + 0.5 * rng.random())
            cv2.ellipse(green, (int(x), iy), (max(1, int(r)), max(1, int(r * 0.78))), 0, 0, 360, c.tolist(), -1, cv2.LINE_AA)
            cv2.ellipse(green, (int(x - r * 0.15), int(iy - r * 0.3)), (max(1, int(r * 0.5)), max(1, int(r * 0.34))), 0, 0, 360, (c * 1.08).tolist(), -1, cv2.LINE_AA)
        y += max(1.4, s_ * 0.55)
    return out * (1 - g[..., None]) + green * g[..., None]


def make_parser():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('photo')
    ap.add_argument('out')
    ap.add_argument('--preset', default='golden', choices=sorted(PRESETS))
    ap.add_argument('--style', default='cel', choices=['planes', 'illustrate', 'cel', 'strokes'], help='planes: flat angular shapes and thin pen, the one hand of a panorama. illustrate: soft planes, rose ramp, thin pen. cel: flat shapes, hard tones, ink, forest tree by tree (the look of the game). strokes: the old painted strokes, which melt rock into marble')
    ap.add_argument('--crop', default=None, help='x0,y0,x1,y1 in 0..1 of the photo')
    ap.add_argument('--pad-top', type=float, default=0.0, help='fraction of the height of extra sky added on top')
    ap.add_argument('--width', type=int, default=2400, help='output width, px')
    ap.add_argument('--quality', type=int, default=82)
    ap.add_argument('--foot', type=float, default=0.9, help='row (0..1) under which it is all mist')
    ap.add_argument('--foot-soft', type=float, default=0.16, help='how many rows the dissolve takes')
    ap.add_argument('--air', type=float, default=0.55, help='how much the land goes to haze down to the foot')
    ap.add_argument('--air-from', type=float, default=0.15, help='share of the way from ridge to foot where the haze starts')
    ap.add_argument('--mist', default=None, help='base mist colour, default the preset')
    ap.add_argument('--tones', type=int, default=8)
    ap.add_argument('--soft', type=float, default=0.4, help='softness of the steps between tones, 0 hard, 0.5 none')
    ap.add_argument('--form', type=float, default=0.15, help='how much the broad form of the massif carries the tone')
    ap.add_argument('--gamma', type=float, default=1.0, help='over the auto exposure: over 1 darker')
    ap.add_argument('--mid', type=float, default=0.52, help='tone (0..1) the median of the rock lands on')
    ap.add_argument('--lo', type=float, default=2.0, help='percentile of the rock that is the darkest tone')
    ap.add_argument('--hi', type=float, default=99.5, help='percentile of the rock that is the lightest tone')
    ap.add_argument('--local', type=float, default=0.3, help='contrast of the detail over its broad masses')
    ap.add_argument('--facet', type=float, default=3.0, help='Kuwahara radius at 2400 px wide')
    ap.add_argument('--strokes', type=int, default=2, help='passes of strokes along the grain')
    ap.add_argument('--shock', type=int, default=2, help='passes of the shock filter')
    ap.add_argument('--ink', type=float, default=0.9, help='strength of the lines on the faces')
    ap.add_argument('--ink-t', type=float, default=20, help='Canny threshold: lower, more lines')
    ap.add_argument('--ink-len', type=int, default=45, help='shortest line kept, in px at 2400')
    ap.add_argument('--fine', type=float, default=0.75, help='strength of the second, finer pen')
    ap.add_argument('--fine-t', type=float, default=24, help='its Canny threshold: lower, more lines')
    ap.add_argument('--fine-len', type=int, default=30, help='its shortest line, px at 2400')
    ap.add_argument('--pen', type=float, default=0.62, help='width of the pen on the faces, px at 2400')
    ap.add_argument('--ink-ridge', type=float, default=0.95, help='strength of the line on the ridge')
    ap.add_argument('--ridge-ink', type=float, default=0.55, help='half width of the ridge line, px at 2400')
    ap.add_argument('--rim', type=float, default=0.35, help='light on the land under the ridge line')
    ap.add_argument('--snow', type=float, default=0.8, help='brightness (0..1) over which colourless land is snow')
    ap.add_argument('--dark-veg', type=float, default=1.0, help='how readily dark ground counts as forest')
    ap.add_argument('--veg-dark', type=float, default=0.32, help='brightness (0..1) under which low ground is forest')
    ap.add_argument('--grain', type=float, default=0.35, help='dry brush along the grain of the rock')
    ap.add_argument('--veg-from', type=float, default=0.42, help='share of the way from ridge to foot above which nothing is forest')
    ap.add_argument('--larch', type=float, default=0.55, help='golden larch patches painted into green forest, 0..1')
    ap.add_argument('--sky-top', type=float, default=0.04, help='rows at the top that are surely sky')
    ap.add_argument('--land-from', type=float, default=0.8, help='row under which it is surely land')
    ap.add_argument('--cloud', type=float, default=0.0, help='a white cloud touching the ridge is sky: how smooth it must be, in L units, 1.5 is a start; 0 is off')
    ap.add_argument('--sky-only', action='store_true', help='keep the land as it is, a painting already: only its sky becomes the track\'s')
    ap.add_argument('--pen-step', type=float, default=0.07, help='with --sky-only: the drop in brightness that counts as the pen on the ridge')
    ap.add_argument('--veg-air', type=float, default=0.3, help='extra haze on the painted forest: it stands further off than the 3D trees in front of it')
    ap.add_argument('--place', default=None, help='width,elevation in degrees of the panel in the track: then the sky of each row is the real sky of its elevation (preset sky_el)')
    ap.add_argument('--cel-sp', type=int, default=9, help='cel: mean shift radius in space, px at 2400')
    ap.add_argument('--cel-sr', type=int, default=20, help='cel: mean shift radius in colour: bigger, flatter shapes')
    ap.add_argument('--crease', type=float, default=0.85, help='cel: strength of the lines along the gullies')
    ap.add_argument('--crease-s', type=float, default=1.8, help='cel: width of the gullies that get a line, px at 2400')
    ap.add_argument('--crease-t', type=float, default=0.012, help='cel: how deep a gully must be for a line')
    ap.add_argument('--crease-len', type=float, default=26, help='cel: shortest gully line, px at 2400')
    ap.add_argument('--cel-soft', type=float, default=3.0, help='cel: size of the planes, px at 2400')
    ap.add_argument('--cel-tone', type=float, default=0.1, help='cel: change of brightness that still counts as one plane')
    ap.add_argument('--cel-clean', type=int, default=7, help='cel: smallest fleck of a tone, px at 2400')
    ap.add_argument('--strata', type=float, default=0.0, help='cel: strength of the bedding lines, for rock that shows them (Pelmo)')
    ap.add_argument('--strata-t', type=float, default=0.012, help='cel: how dark a bedding line must be against its surroundings')
    ap.add_argument('--strata-len', type=int, default=60, help='cel: shortest bedding line, px at 2400')
    ap.add_argument('--veg-any', type=float, default=0.0, help='cel: brightness under which land is forest whatever its colour, for a slope gone blue in its own shade')
    ap.add_argument('--tree', type=float, default=9.0, help='cel: height of a painted tree, px at 2400')
    ap.add_argument('--larch-from', type=float, default=14.0, help='cel: warmth in LAB where a tree starts to be a larch')
    ap.add_argument('--veg-min', type=int, default=500, help='cel: smallest patch of forest, px at 2400')
    ap.add_argument('--no-trees', action='store_true', help='cel: flat forest')
    ap.add_argument('--sun-side', type=float, default=-1.0, help='cel: -1 the sun is to the left of this view, +1 to the right')
    ap.add_argument('--grain-s', type=float, default=4.0, help='illustrate: size over which the grain of the rock is read, px at 2400')
    ap.add_argument('--grain-len', type=float, default=9.0, help='illustrate: length of a smoothing stroke along the grain, px at 2400')
    ap.add_argument('--step', type=float, default=0.4, help='illustrate: how much the tones gather into steps')
    ap.add_argument('--v-max', type=float, default=0.93, help='illustrate: the brightest tone on the ramp: snow stays a cream ledge')
    ap.add_argument('--bend', type=float, default=1.8, help='illustrate: how much a pen stroke may wind along its way')
    ap.add_argument('--foot-air', type=float, default=0.6, help='illustrate: how much of the teal evening air the foot of the land takes')
    ap.add_argument('--plane-px', type=float, default=1.0, help='planes: scale of its sizes against 45 px per degree')
    ap.add_argument('--plane-sm', type=float, default=3.2, help='planes: smoothing of the outline of a shape, px')
    ap.add_argument('--plane-eps', type=float, default=3.2, help='planes: how far a shape may be straightened, px: bigger, more angular')
    ap.add_argument('--plane-min', type=float, default=260, help='planes: smallest shape, px squared')
    ap.add_argument('--plane-local', type=float, default=1.0, help='planes: contrast of the shapes over the broad masses of the face')
    ap.add_argument('--plane-wash', type=float, default=0.16, help='planes: the light across the whole face')
    ap.add_argument('--plane-gully', type=float, default=0.5, help='planes: pen on the long gullies')
    ap.add_argument('--veg-cut', type=float, default=0.14, help='planes: tone under which ground at the foot is forest')
    ap.set_defaults(plane_cuts=(0.22, 0.42, 0.62, 0.82), plane_tones=(0.05, 0.26, 0.47, 0.68, 0.88), plane_pen=(0, 1), veg_hint=None, veg_top=None, veg_force=None, plane_green=None, plane_grass=None, plane_bed=None)
    ap.add_argument('--sky-bottom', type=float, default=None, help='row where the sky reaches its horizon colour (default just under the ridge)')
    return ap


def main():
    a = make_parser().parse_args()

    im = Image.open(a.photo).convert('RGB')
    if a.crop:
        x0, y0, x1, y1 = [float(q) for q in a.crop.split(',')]
        im = im.crop((int(x0 * im.width), int(y0 * im.height), int(x1 * im.width), int(y1 * im.height)))
    # worked at output size: every radius scales with it
    h = int(round(im.height * a.width / im.width))
    rgb = np.asarray(im.resize((a.width, h), Image.LANCZOS), dtype=np.float32) / 255.0
    if a.pad_top > 0:
        # more sky above: the top row stretched, thrown away with the rest of the sky anyway
        pad = int(h * a.pad_top)
        rgb = np.vstack([np.repeat(rgb[:1], pad, axis=0), rgb])
    if a.sky_only:
        out, ridge = sky_only(rgb, PRESETS[a.preset], a)
    else:
        if a.style in ('cel', 'illustrate', 'planes'):
            land, sky_mask, ridge, _ = {'illustrate': illustrate, 'planes': planes}.get(a.style, cel)(rgb, PRESETS[a.preset], a)
            sky = row_sky(PRESETS[a.preset], a, ridge, *land.shape[:2])
            foot = smoothstep(a.foot - a.foot_soft, a.foot, np.arange(land.shape[0], dtype=np.float32)[:, None] / land.shape[0])[..., None]
            land = land * (1 - foot) + hexrgb(a.mist or PRESETS[a.preset]['mist']) * foot
            out = sky * sky_mask[..., None] + land * (1 - sky_mask[..., None])
        else:
            out, ridge, _ = paint(rgb, PRESETS[a.preset], a)
    Image.fromarray((out * 255 + 0.5).astype(np.uint8)).save(a.out, quality=a.quality, subsampling=0, optimize=True, progressive=True)
    H, W = out.shape[:2]
    top = int(np.argmin(cv2.GaussianBlur(ridge.reshape(1, -1), (0, 0), 3)[0]))
    mist = hexrgb(a.mist or PRESETS[a.preset]['mist'])
    print(json.dumps({
        'file': os.path.basename(a.out), 'size': [W, H], 'kb': round(os.path.getsize(a.out) / 1024),
        'summit': {'u': round(top / W, 4), 'row': round(float(ridge[top]) / H, 4)},
        'foot': a.foot, 'mist': '#%02x%02x%02x' % tuple(int(c * 255 + 0.5) for c in mist),
    }))


if __name__ == '__main__':
    sys.exit(main())
