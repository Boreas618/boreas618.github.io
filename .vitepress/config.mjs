import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "Yi Sun's Homepage",
  description: "This is Yi Sun's homepage.",
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
    /*[
      'script',
      {},
      "document.addEventListener('DOMContentLoaded', function(){fetch('https://122.51.174.109:32243').then(response => response.json());})",
    ],*/
  ],
  markdown: {
    math: true
  },
  themeConfig: {
    nav: [

    ],
    sidebar: {
      '/': {
        text: 'Me',
        items: [
          { text: 'Biography', link: '/' },
        ],
      }
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/boreas618' }
    ]
  }
})
