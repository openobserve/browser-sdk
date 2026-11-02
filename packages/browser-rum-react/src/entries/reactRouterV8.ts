/**
 * React Router v8 integration.
 *
 * @packageDocumentation
 * @example
 * ```ts
 * import { RouterProvider } from 'react-router/dom'
 * import { openobserveRum } from '@openobserve/browser-rum'
 * import { reactPlugin } from '@openobserve/browser-rum-react'
 *
 * // ⚠️ Use "createBrowserRouter" from `@openobserve/browser-rum-react/react-router` instead of `react-router`
 * import { createBrowserRouter } from '@openobserve/browser-rum-react/react-router'
 *
 * openobserveRum.init({
 *   applicationId: '<OPENOBSERVE_APPLICATION_ID>',
 *   clientToken: '<OPENOBSERVE_CLIENT_TOKEN>',
 *   plugins: [reactPlugin({ router: true })],
 *   // ...
 * })
 *
 * const router = createBrowserRouter([
 *   {
 *     path: '/',
 *     element: <Root />,
 *     // ...
 *   },
 * ])
 *
 * ReactDOM.createRoot(document.getElementById('root')).render(<RouterProvider router={router} />)
 * ```
 */
/* eslint-disable local-rules/disallow-side-effects */

import { setReactRouterType } from '../domain/reactPlugin'

export { createBrowserRouter, createHashRouter, createMemoryRouter, useRoutes, Routes } from './reactRouterV7'

setReactRouterType('react-router-v8')
