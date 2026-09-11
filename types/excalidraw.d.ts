/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @excalidraw/excalidraw không ship type cho đường import `dist/prod/index.js`
 * mà bundler resolve tới, nên `tsc --noEmit` báo TS7016 cho mọi chỗ dùng.
 *
 * Khai báo `any` là mức đầu tư đúng ở đây: Excalidraw đã được giới hạn phạm vi
 * về công cụ rời `/draw-test` (SRS pipeline dùng PlantUML render phía server —
 * Product-Brief-to-SRS-Phases.md §7.1), nên viết type thật cho nó là công bỏ đi.
 * Bản thân code gọi cũng đang dùng `any` ở mọi tham số.
 */
declare module "@excalidraw/excalidraw" {
  const Excalidraw: any
  const exportToSvg: any
  const exportToBlob: any
  const exportToClipboard: any
  const serializeAsJSON: any
  const loadFromBlob: any
  const convertToExcalidrawElements: any
  const MainMenu: any
  const WelcomeScreen: any
  const Footer: any
  const Sidebar: any

  export {
    Excalidraw,
    exportToSvg,
    exportToBlob,
    exportToClipboard,
    serializeAsJSON,
    loadFromBlob,
    convertToExcalidrawElements,
    MainMenu,
    WelcomeScreen,
    Footer,
    Sidebar
  }

  const _default: any
  export default _default
}

declare module "@excalidraw/mermaid-to-excalidraw" {
  export const parseMermaidToExcalidraw: any
}
