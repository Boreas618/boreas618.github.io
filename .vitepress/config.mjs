import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Yi Sun's Blog",
  description: "This is Yi Sun's blog.",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Me', link: '/' },
      { text: 'Posts', link: '/posts/monitor' }
    ],
    sidebar: {
      '/': {
        text: 'Me',
        items: [
        ],
        collapsed: true,
      },
      '/posts/': {
        text: 'System',
        items: [
          { text: 'Monitor, Condition Variables and Three Semantics', link: '/posts/monitor' },
          { text: 'Exception and Interrupt Handling in xv6', link: '/posts/xv6-trap' },
          { text: 'Function Prologues', link: '/posts/function-prologues' },
        ]
      }
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/vuejs/vitepress' }
    ]
  }
})
