import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Yi Sun's Blog",
  description: "This is Yi Sun's blog.",
  themeConfig: {
    nav: [
      { text: 'Me', link: '/' },
      { text: 'Posts', link: '/posts/monitor' },
    ],
    sidebar: {
      '/': {
        text: 'Me',
        items: [
          { text: 'Biograhy', link: '/' },
        ],
      },
      '/os-notes/': {
        text: 'OS Notes',
        items: [
          {text: 'Introduction', link: '/os-notes/introduction'},
          {text: 'Process and Thread', link: '/os-notes/process-and-thread'},
        ],
      },
      '/posts/': [{
        text: 'Operating Systems',
        items: [
          { text: 'Monitor, Condition Variables and Three Semantics', link: '/posts/monitor' },
          { text: 'Exception and Interrupt Handling in xv6', link: '/posts/xv6-trap' },
          { text: 'Function Prologues', link: '/posts/function-prologues' },
          { text: 'TreeSLS', link: '/papers/TreeSLS' },
          { text: 'Transactional Memory', link: '/papers/transactional-memory' },
          { text: 'Kubernetes Scheduling', link: '/papers/kuber-scheduling' },
          { text: 'CLoF', link: '/papers/CLoF' },
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
