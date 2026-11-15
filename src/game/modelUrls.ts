/**
 * Runtime model table. Production builds reference the stable project-storage addresses that
 * sync/save registered in assets.lock.json. Local dev serves the editable source copies under
 * assets/models/ so gameplay can be inspected without a hosted API/storage origin.
 */
const STORAGE = {
  player: '/manus-storage/game/sha256/0f54068fbceae82d576c0b907cce7fdafef555fb0e79ac1534bc2160f0566b15.glb',
  npcs: {
    grandma: '/manus-storage/game/sha256/2788c098b658d18d85b2cf31683b27eb9fd2b47b1ce011eb06714da86d3beded.glb',
    fairy: '/manus-storage/game/sha256/d5e3d85a20d0cd89e94d055349dbb565ac307e558ac05d957093195fd0be96eb.glb',
    mushroom: '/manus-storage/game/sha256/f286ccfb80b0dbed35022426c089c78ed15b3fa1d2c02a1a018d4003057bbbab.glb',
    cat: '/manus-storage/game/sha256/bfbde94c377ed7ecbae87a546e3fcf5a2351d45efaf7b5859bf35a3361ce745e.glb',
  },
  items: {
    berry: '/manus-storage/game/sha256/2d390176db3987f2498de1713511ffb15a42ce3a0e8f14e3150849b74e188200.glb',
    crystal: '/manus-storage/game/sha256/be23be4323bdabf530a4f07e714a7e1a8209ea0811f3ef04da9392c6cae5a092.glb',
    mushroom: '/manus-storage/game/sha256/d110b21f3f7d7c4bedecadc699f9050aa24b7c9ba6658296add0851ad5bdca29.glb',
    star: '/manus-storage/game/sha256/478db9d318616e8ac4d185df6a99060000b9ad9ae950cbe98fe0e6317a172e42.glb',
  },
  props: {
    tree: '/manus-storage/game/sha256/db1d1d5fba14ca5b501559e3e569cd88e5272540a0597f14c6dd0fc691a6ecf4.glb',
    cottage: '/manus-storage/game/sha256/1c9259cc1daaa45df2761e708707baa7e7f21ecdf4d6c8de6fc2de0c5c1159e6.glb',
  },
} as const

const LOCAL = {
  player: '/assets/models/plyuhik-animated.glb',
  npcs: {
    grandma: '/assets/models/npc-grandma.glb',
    fairy: '/assets/models/npc-fairy.glb',
    mushroom: '/assets/models/npc-mushroom.glb',
    cat: '/assets/models/npc-cat.glb',
  },
  items: {
    berry: '/assets/models/item-berry.glb',
    crystal: '/assets/models/item-crystal.glb',
    mushroom: '/assets/models/item-mushroom.glb',
    star: '/assets/models/item-star.glb',
  },
  props: {
    tree: '/assets/models/prop-tree.glb',
    cottage: '/assets/models/prop-cottage.glb',
  },
} as const

export const MODEL_URLS = import.meta.env.DEV ? LOCAL : STORAGE
