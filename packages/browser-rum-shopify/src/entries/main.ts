import { globalObject } from '@openobserve/js-core/util'
import { defineGlobal } from '@openobserve/browser-core'
import type { RumPublicApi } from '@openobserve/browser-rum-core'
import { makeRumPublicApi } from '@openobserve/browser-rum-core'
import { makeRecorderApi, makeProfilerApi } from '@openobserve/browser-rum/internal'
import { shopifyPlugin } from '../domain/shopifyPlugin'

type ShopifyRumPublicApi = RumPublicApi & { shopifyPlugin: typeof shopifyPlugin }

interface BrowserWindow {
  O2_RUM?: ShopifyRumPublicApi
}

const global = globalObject as BrowserWindow

const openobserveRum = makeRumPublicApi(makeRecorderApi(), makeProfilerApi(), {
  sdkName: 'rum-shopify',
}) as ShopifyRumPublicApi

openobserveRum.shopifyPlugin = shopifyPlugin

defineGlobal(global, 'O2_RUM', openobserveRum)
