import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Yi Sun's Blog",
  description: "This is Yi Sun's blog.",
  themeConfig: {
    nav: [
      { text: 'Me', link: '/' },
      { text: 'Posts', link: '/posts/monitor' },
      { text: 'Paper Reading', link: '/papers/TreeSLS' },
    ],
    sidebar: {
      '/': {
        text: 'Me',
        items: [
          { text: 'Biograhy', link: '/ },
          { text: 'Something Fun', link: '/ }
        ],
      },
      '/posts/': {
        text: 'Operating Systems',
        items: [
          { text: 'Monitor, Condition Variables and Three Semantics', link: '/posts/monitor' },
          { text: 'Exception and Interrupt Handling in xv6', link: '/posts/xv6-trap' },
          { text: 'Function Prologues', link: '/posts/function-prologues' },
        ]
      },
      '/papers/': [{
        text: 'Operating Systems',
        items: [
          { text: 'TreeSLS', link: '/papers/TreeSLS' },
        ]
      }, {
        text: 'NLP',
        items: [
        ]
      }
      ]
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/boreas618' }
    ]
  }
})
