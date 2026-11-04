import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>
const base = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true } as const

export const FacebookIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M14 8h3V4h-3c-2.8 0-5 2.2-5 5v2H7v4h2v7h4v-7h3l1-4h-4V9c0-.6.4-1 1-1z" />
  </svg>
)
export const InstagramIcon = (p: P) => (
  <svg {...base} fill="none" stroke="currentColor" strokeWidth={2} {...p}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
  </svg>
)
export const TwitterIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M22 5.9c-.7.3-1.5.5-2.3.6.8-.5 1.5-1.3 1.8-2.2-.8.5-1.7.8-2.6 1-1.6-1.7-4.4-1.7-6 0-1 1-1.4 2.5-1.1 3.9-3.3-.2-6.4-1.7-8.5-4.3-1.1 1.9-.5 4.3 1.3 5.5-.6 0-1.3-.2-1.8-.5 0 2 1.4 3.7 3.3 4.1-.6.2-1.3.2-1.9.1.5 1.7 2.1 2.9 3.9 2.9-1.7 1.4-3.9 2.1-6.1 1.8 1.9 1.2 4.1 1.9 6.4 1.9 7.7 0 12.1-6.5 11.8-12.4.9-.6 1.6-1.4 2.1-2.3z" />
  </svg>
)
export const LinkedinIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM2 9h4v12H2zM9 9h3.8v1.7c.6-1 1.9-2 3.9-2 4 0 4.3 2.6 4.3 6V21h-4v-5.5c0-1.3 0-3-1.9-3s-2.1 1.4-2.1 2.9V21H9z" />
  </svg>
)
export const YoutubeIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M23 7.2s-.2-1.6-.9-2.3c-.9-.9-1.9-.9-2.3-1C16.6 3.6 12 3.6 12 3.6s-4.6 0-7.8.3c-.4 0-1.4.1-2.3 1C1.2 5.6 1 7.2 1 7.2S.8 9 .8 10.9v1.8c0 1.9.2 3.7.2 3.7s.2 1.6.9 2.3c.9.9 2 .9 2.5 1 1.8.2 7.6.2 7.6.2s4.6 0 7.8-.3c.4 0 1.4-.1 2.3-1 .7-.7.9-2.3.9-2.3s.2-1.9.2-3.7v-1.8C23.2 9 23 7.2 23 7.2zM9.7 14.6V8.4l6 3.1-6 3.1z" />
  </svg>
)
