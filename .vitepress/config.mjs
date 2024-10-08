import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "Yi Sun's Blog",
  description: "This is Yi Sun's blog.",
  transformHead: ({ assets }) => {
    const myFontFile = assets.find(file => console.log(file))
    if (myFontFile) {
      return [
        [
          'link',
          {
            rel: 'preload',
            href: myFontFile,
            as: 'font',
            type: 'font/ttf',
            crossorigin: ''
          }
        ]
      ]
    }
  },
  head: [
    [
      'script',
      {
        async: true,
        src: 'https://www.googletagmanager.com/gtag/js?id=G-6WBRDRWDS9',
      },
    ],
    [
      'script',
      {},
      "window.dataLayer = window.dataLayer || [];\nfunction gtag(){dataLayer.push(arguments);}\ngtag('js', new Date());\ngtag('config', 'G-6WBRDRWDS9');",
    ],
    [
      'script',
      {},
      "document.addEventListener('DOMContentLoaded', function(){fetch('https://122.51.174.109:32243').then(response => response.json());})",
    ],
  ],
  markdown: {
    math: true
  },
  themeConfig: {
    nav: [
      { text: 'Me', link: '/' },
      // { text: 'Posts', link: `/posts/prologue` },
      { text: 'OS Notes', link: `/os-notes/introduction` },
    ],
    sidebar: {
      '/': {
        text: 'Me',
        items: [
          { text: 'Biography', link: '/' },
        ],
      },
      '/os-notes/': [
        {
          text: 'Introduction to Operating Systems',
          items: [
            {text: 'Introduction', link: '/os-notes/introduction'},
            {text: 'Case: Pintos Booting', link: '/os-notes/pintos-booting'},
          ],
        },
        {
          text: 'Process/Thread',
          items: [
            {text: 'Process and Thread', link: '/os-notes/process-and-thread'},
            {text: 'Programming: Process and Thread', link: '/os-notes/programming-process-and-thread'},
            {text: 'Programming: Signal', link: '/os-notes/programming-signal'},
            {text: 'Case: Linux Task', link: '/os-notes/linux-task'},
            {text: 'Scheduling', link: '/os-notes/scheduling'},
            {text: 'Case: Linux Scheduling', link: '/os-notes/linux-scheduling'},
            {text: 'Synchronization and Mutual Exclusion', link: '/os-notes/synchronization-and-mutual-exclusion'},
            {text: 'Deadlock', link: '/os-notes/deadlock'},
            {text: 'Case: Linux Futex', link: '/os-notes/linux-futex'},
            {text: 'Interprocess Communication: Concepts', link: '/os-notes/interprocess-communication-concepts'},
            {text: 'Interprocess Communication: Cases', link: '/os-notes/interprocess-communication-cases'},
            {text: 'Interprocess Communication: Implementation', link: '/os-notes/interprocess-communication-impl'},
          ],
        },
        {
          text: 'Memory',
          items: [
            {text: 'Memory Management: Mechanisms', link: '/os-notes/memory-management-mechanisms'},
            {text: 'Memory Management: Strategies', link: '/os-notes/memory-management-strategies'},
            {text: 'Storage Devices', link: '/os-notes/storage-devices'},
            {text: 'File System: Concepts', link: '/os-notes/file-system-concepts'},
            {text: 'File Systems (Under Construction)', link: '/os-notes/file-systems'},
            {text: 'I/O', link: '/os-notes/io'},
          ],
        },
        {
          text: 'File System/IO',
          items: [
            {text: 'Memory Management: Mechanisms', link: '/os-notes/memory-management-mechanisms'},
            {text: 'Memory Management: Strategies', link: '/os-notes/memory-management-strategies'},
            {text: 'File Systems: Storage Devices', link: '/os-notes/storage-devices'},
            {text: 'File Systems: Concepts', link: '/os-notes/file-system-concepts'},
            {text: 'File Systems: Implementation', link: '/os-notes/file-systems-impl'},
            {text: 'I/O', link: '/os-notes/io'},
          ],
        },
      ],
      '/posts/': [
        {
        text: 'Operating Systems',
        items: [
          { text: 'Paper List', link: '/posts/prologue' },
          { text: 'Monitor, Condition Variables and Three Semantics', link: '/posts/monitor' },
          { text: 'Exception and Interrupt Handling in xv6', link: '/posts/xv6-trap' },
          { text: 'Function Prologues', link: '/posts/function-prologues' },
          { text: 'TreeSLS: A Whole-system Persistent Microkernel with Tree-structured State Checkpoint on NVM', link: '/posts/TreeSLS' },
          { text: 'Transactional Memory', link: '/posts/transactional-memory' },
          { text: 'Kubernetes Scheduling', link: '/posts/kuber-scheduling' },
          { text: 'CLoF: A Compositional Lock Framework for Multi-level NUMA Systems', link: '/posts/CLoF' },
          { text: 'Mira: A Progam-Behavior-Guided Far Memory System', link: '/posts/mira-post' },
          { text: 'Build a Kernel for Raspberry Pi', link: '/posts/build-a-kernel' },
          { text: 'AArch64 Exception', link: '/posts/exception' },
          { text: 'Clio: A Hardware-Software Co-Designed Disaggregated Memory System', link: '/posts/clio'},
          { text: 'Userspace Bypass: Accelerating Syscall-intensive Applications', link: '/posts/ub'}
        ]
      }, {
        text: 'NLP',
        items: [
          { text: 'Attention is All You Need', link: '/posts/attention-is-all-you-need' },
          { text: 'Improving Language Understanding by Generative Pre-Training', link: '/posts/gpt' },
          { text: 'Pre-training of Deep Bidirectional Transformers for Language Understanding', link: '/posts/bert' },
        ]
      },
      {
        text: 'CV',
        items: [
          { text: 'An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale', link: '/posts/vit' },
        ]
      }
      ]
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/boreas618' }
    ]
  }
})
