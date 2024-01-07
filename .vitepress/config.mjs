import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Yi Sun's Blog",
  description: "This is Yi Sun's blog.",
  markdown: {
    math: true
  },
  themeConfig: {
    nav: [
      { text: 'Me', link: '/' },
      { text: 'Posts', link: '/posts/prologue' },
      { text: 'OS Notes', link: '/os-notes/introduction' },
    ],
    sidebar: {
      '/': {
        text: 'Me',
        items: [
          { text: 'Biography', link: '/' },
        ],
      },
      '/os-notes/': {
        text: 'OS Notes',
        items: [
          {text: 'Introduction', link: '/os-notes/introduction'},
          {text: 'Case: Pintos Booting', link: '/os-notes/case-study-pintos-booting'},
          {text: 'Process and Thread', link: '/os-notes/process-and-thread'},
          {text: 'Programming: Process and Thread', link: '/os-notes/programming-process-and-thread'},
          {text: 'Programming: Signal', link: '/os-notes/programming-signal'},
          {text: 'Case: Linux Task', link: '/os-notes/linux-task'},
          {text: 'Scheduling', link: '/os-notes/scheduling'},
          {text: 'Case: Linux Scheduling', link: '/os-notes/linux-scheduling'},
          {text: 'Synchronization and Mutual Exclusion', link: '/os-notes/synchronization-and-mutual-exclusion'},
          {text: 'Deadlock', link: '/os-notes/deadlock'},
          {text: 'Case: Linux Futex', link: '/os-notes/linux-futex'},
          {text: 'Interprocess Communication', link: '/os-notes/interprocess-communication'},
          {text: 'Cache', link: '/os-notes/cache'},
          {text: 'Memory Management: Mechanisms', link: '/os-notes/memory-management-mechanisms'},
          {text: 'Memory Management: Strategies', link: '/os-notes/memory-management-strategies'},
          {text: 'Storage Devices', link: '/os-notes/storage-devices'},
          {text: 'File System Concepts', link: '/os-notes/file-system-concepts'},
          {text: 'File Systems', link: '/os-notes/file-systems'},
          {text: 'I/O', link: '/os-notes/io'},
        ],
      },
      '/posts/': [
        {
        text: 'Operating Systems',
        items: [
          { text: 'Monitor, Condition Variables and Three Semantics', link: '/posts/monitor' },
          { text: 'Exception and Interrupt Handling in xv6', link: '/posts/xv6-trap' },
          { text: 'Function Prologues', link: '/posts/function-prologues' },
          { text: 'TreeSLS', link: '/posts/TreeSLS' },
          { text: 'Transactional Memory', link: '/posts/transactional-memory' },
          { text: 'Kubernetes Scheduling', link: '/posts/kuber-scheduling' },
          { text: 'CLoF', link: '/posts/CLoF' },
        ]
      }, {
        text: 'NLP',
        items: [
          { text: 'Attention is All You Need', link: '/posts/attention-is-all-you-need' },
          { text: 'GPT', link: '/posts/gpt' },
          { text: 'BERT', link: '/posts/bert' },
        ]
      }
      ]
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/boreas618' }
    ]
  }
})
