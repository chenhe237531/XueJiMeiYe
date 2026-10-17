import type { Preset } from 'unocss'
import { FileSystemIconLoader } from '@iconify/utils/lib/loader/node-loaders'

// https://www.npmjs.com/package/@uni-helper/unocss-preset-uni
import { presetUni } from '@uni-helper/unocss-preset-uni'
// @see https://unocss.dev/presets/legacy-compat
import { presetLegacyCompat } from '@unocss/preset-legacy-compat'
import {
  defineConfig,
  presetIcons,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'

export default defineConfig({
  // 这些类名在 style/index.scss 里按设计令牌定义（gap8 = 8px、c-care = var(--care)）；
  // 不屏蔽的话 UnoCSS 会生成同名规则（gap8 = 2rem、c-care = 写死的旧绿色）覆盖掉全局样式
  blocklist: [/^gap\d+$/, /^m[tblrxy]?\d+$/, 'c-care', 'c-brand', 'center'],
  presets: [
    presetUni({
      attributify: false,
    }),
    presetIcons({
      scale: 1,
      warn: true,
      extraProperties: {
        'display': 'inline-block',
        'vertical-align': 'middle',
      },
      collections: {
        // 注册本地 SVG 图标集合, 从本地文件系统加载图标
        // 在 './src/static/my-icons' 目录下的所有 svg 文件将被注册为图标，
        // my-icons 是图标集合名称，使用 `i-my-icons-图标名` 调用
        'my-icons': FileSystemIconLoader(
          './src/static/my-icons',
          // 可选的，你可以提供一个 transform 回调来更改每个图标
          (svg) => {
            let svgStr = svg

            // 如果 SVG 文件未定义 `fill` 属性，则默认填充 `currentColor`, 这样图标颜色会继承文本颜色，方便在不同场景下适配
            svgStr = svgStr.includes('fill="')
              ? svgStr
              : svgStr.replace(/^<svg /, '<svg fill="currentColor" ')

            // 如果 svg 有 width, 和 height 属性，将这些属性改为 1em，否则无法显示图标
            svgStr = svgStr
              .replace(/(<svg.*?width=)"(.*?)"/, '$1"1em"')
              .replace(/(<svg.*?height=)"(.*?)"/, '$1"1em"')

            return svgStr
          },
        ),
        /**
         * 彩色图形集合（开源图形，MIT 许可，见 src/icons/graphics/LICENSE.md）。
         *
         * ⚠️ 这里**故意不做 transform**：绝不能像 my-icons 那样注入 fill="currentColor"。
         * UnoCSS 的图标模式是 auto —— SVG 里出现 currentColor 会判定为 mask（单色遮罩），
         * 颜色会被抹掉；不含 currentColor 才判定为 bg，保留图形原色。
         * 本目录图形全部为硬编码 fill，因此保持原样即可呈现彩色。
         *
         * 资源更新：node ./scripts/fetch-graphics.js --force
         */
        'graphics': FileSystemIconLoader('./src/icons/graphics'),
      },
    }),
    // TODO: check 是否会有别的影响
    // 处理低端安卓机的样式问题
    // 将颜色函数 (rgb()和hsl()) 从空格分隔转换为逗号分隔，更好的兼容性app端，example：
    // `rgb(255 0 0)` -> `rgb(255, 0, 0)`
    // `rgba(255 0 0 / 0.5)` -> `rgba(255, 0, 0, 0.5)`
    presetLegacyCompat({
      commaStyleColorFunction: true,
      legacyColorSpace: true, // by QQ4群-量子蔷薇
      // @菲鸽 unocss 配置中，建议在 presetLegacyCompat 中添加 legacyColorSpace: true，以去除生成的颜色样式中的 in oklch 关键字，现在发现有些渐变色生成不符合预期
    }) as Preset,
  ],
  transformers: [
    // 启用指令功能：主要用于支持 @apply、@screen 和 theme() 等 CSS 指令
    transformerDirectives(),
    // 启用 () 分组功能
    // 支持css class组合，eg: `<div class="hover:(bg-gray-400 font-medium) font-(light mono)">测试 unocss</div>`
    transformerVariantGroup(),
  ],
  shortcuts: [
    {
      center: 'flex justify-center items-center',
    },
  ],
  // 动态图标需要在这里配置，或者写在vue页面中注释掉
  safelist: [
    'i-tabler-home',
    'i-tabler-building-store',
    'i-tabler-star',
    'i-tabler-calendar-plus',
    'i-tabler-massage',
    'i-tabler-copy',
    'i-tabler-user-heart',
    'i-tabler-clipboard-heart',
    'i-tabler-message-heart',
    'i-tabler-sparkles',
    'i-tabler-user',
    'i-tabler-hexagon',
    'i-tabler-stethoscope',
    'i-tabler-users',
    'i-tabler-notebook',
    'i-tabler-calendar-check',
    'i-tabler-bulb',
    'i-tabler-cards',
    'i-tabler-users-group',
    'i-tabler-leaf',
    'i-tabler-gift',
    'i-tabler-coins',
    'i-tabler-presentation',
    'i-tabler-beach',
    'i-tabler-trees',
    'i-tabler-sun',
    'i-tabler-mountain',
    'i-tabler-plane',
    'i-tabler-headset',
    'i-tabler-heart-rate-monitor',
    'i-tabler-car',
    'i-tabler-glass-full',
    'i-tabler-report-medical',
    'i-tabler-ticket',
    'i-tabler-calendar-event',
    'i-tabler-phone-call',
    'i-tabler-circle',
    'i-tabler-chevron-right',
    'i-tabler-chevron-left',
    'i-tabler-volume',
    'i-tabler-microphone',
    'i-tabler-keyboard',
    'i-tabler-shield-check',
    'i-tabler-lock',
    'i-tabler-check',
    'i-tabler-x',
    'i-tabler-alert-triangle',
    'i-tabler-phone',
    'i-tabler-bell',
    'i-tabler-settings',
    'i-tabler-file-text',
    'i-tabler-chart-line',
    'i-tabler-photo',
    'i-tabler-info-circle',
    'i-tabler-player-play',
    'i-tabler-clock',
    'i-tabler-map-pin',
    'i-tabler-share',
    'i-tabler-download',
    'i-tabler-heart',
    'i-tabler-mood-smile',
    'i-tabler-moon',
    'i-tabler-run',
    'i-tabler-droplet',
    'i-tabler-calendar',
    'i-tabler-wallet',
    'i-tabler-award',
    'i-tabler-crown',
    'i-tabler-shield-heart',
    'i-tabler-building-hospital',
    'i-tabler-first-aid-kit',
    'i-tabler-armchair',
    'i-tabler-activity',
    'i-tabler-bed',
    'i-tabler-scale',
    'i-tabler-list-check',
    'i-tabler-history',
    'i-tabler-heartbeat',
    'i-tabler-brain',
    'i-tabler-flower',
    'i-tabler-trash',
    'i-tabler-refresh',
    'i-tabler-arrow-up',
    'i-tabler-arrow-down',
    'i-tabler-arrow-right',
    'i-tabler-minus',
    'i-tabler-plus',
    'i-tabler-logout',
    'i-tabler-qrcode',
    'i-tabler-scan',
    'i-tabler-message-circle',
    'i-tabler-send',
    'i-tabler-circle-check',
    'i-tabler-circle-x',
    'i-tabler-hourglass',
    'i-tabler-walk',
    'i-tabler-eye',
    'i-tabler-pill',
    'i-tabler-accessible',
    'i-tabler-bus',
    'i-tabler-messages',
    'i-tabler-notes',
    'i-tabler-wifi-off',
    'i-tabler-plant',
    'i-tabler-grid-dots',
    'i-tabler-home-filled',
    'i-tabler-sparkles-filled',
    'i-tabler-user-filled',
    // 徽章未解锁态的线稿图标（配合 XBadge 的 outline 属性使用）
    'i-tabler-trophy',
    'i-tabler-flame',
    'i-tabler-medal',
    'i-tabler-clover',
    'i-tabler-lock-open',
    // ── 彩色图形（i-graphics-*）：由 scripts/fetch-graphics.js 生成，见 src/xj/graphics.ts ──
    // 组件里虽已写成完整字面量，仍在此冗余登记，避免 UnoCSS 扫描范围变化导致图标静默丢失
    'i-graphics-dim-skin',
    'i-graphics-dim-shape',
    'i-graphics-dim-contour',
    'i-graphics-dim-fitness',
    'i-graphics-dim-posture',
    'i-graphics-dim-mind',
    'i-graphics-badge-trophy',
    'i-graphics-badge-medal-gold',
    'i-graphics-badge-medal-honor',
    'i-graphics-badge-star',
    'i-graphics-badge-fire',
    'i-graphics-badge-crown',
    'i-graphics-badge-clover',
    'i-graphics-play-gift',
    'i-graphics-play-celebrate',
    'i-graphics-play-wand',
    'i-graphics-play-ball',
    'i-graphics-play-dice',
    'i-graphics-play-ticket',
    'i-graphics-play-balloon',
    'i-graphics-play-sparkle',
    'i-graphics-play-ring',
    'i-graphics-care-salad',
    'i-graphics-care-pill',
    'i-graphics-care-stethoscope',
    'i-graphics-care-moon',
    'i-graphics-care-sun',
    'i-graphics-care-bell',
    'i-graphics-care-wait',
    'i-graphics-care-done',
    'i-graphics-care-cross',
    'i-graphics-care-warn',
    'i-graphics-care-heart',
    'i-graphics-care-up',
    'i-graphics-care-chart',
    'i-graphics-care-seed',
    'i-graphics-talk-bubble',
    'i-graphics-talk-megaphone',
    'i-graphics-store-bag',
    'i-graphics-store-house',
    'i-graphics-doc-memo',
    'i-graphics-doc-calendar',
    'i-graphics-doc-scroll',
    'i-graphics-mood-smile',
    'i-graphics-mood-love',
    'i-graphics-mood-think',
    'i-graphics-mood-hug',
  ],
  rules: [
    [
      'p-safe',
      {
        padding:
          'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)',
      },
    ],
    ['pt-safe', { 'padding-top': 'env(safe-area-inset-top)' }],
    ['pb-safe', { 'padding-bottom': 'env(safe-area-inset-bottom)' }],
  ],
  theme: {
    colors: {
      /** 主题色，用法如: text-primary */
      primary: '#C9A063',
      brand: 'var(--brand-ink)', // 文字 / 图标用的品牌色（随乐龄 / 臻享皮肤变化）；黄色底用 var(--brand)
      care: '#6E7F5C',
      ink: '#222222',
      gold: '#D2B47A',
    },
    fontSize: {
      /** 提供更小号的字体，用法如：text-2xs */
      '2xs': ['20rpx', '28rpx'],
      '3xs': ['18rpx', '26rpx'],
    },
  },
  // windows 系统会报错：[plugin:unocss:transformers:pre] Cannot overwrite a zero-length range - use append Left or prependRight instead.
  // 去掉下面的就正常了
  // content: {
  //   /**
  //    * 解决小程序报错 `./app.wxss(78:2814): unexpected unexpected at pos 5198`
  //    * 为什么同时使用include和exclude？虽然看起来多余，但同时配置两者是一种常见的 `防御性编程` 做法。
  //      1. 结构变化保障 : 如果未来项目结构发生变化，某些排除目录可能被移动到包含路径下，exclude配置可以确保它们仍被排除
  //      2. 明确性 : 明确列出要排除的目录使配置意图更加清晰
  //      3. 性能优化 : 避免处理不必要的文件，提高构建性能
  //      4. 防止冲突 : 排除第三方库和构建输出目录，避免潜在的CSS冲突
  //    */
  //   pipeline: {
  //     exclude: [
  //       'node_modules/**/*',
  //       'public/**/*',
  //       'dist/**/*',
  //     ],
  //     include: [
  //       './src/**/*',
  //     ],
  //   },
  // },
})
