import { LightningElement, wire } from 'lwc'
import { NavigationMixin, CurrentPageReference } from 'lightning/navigation'
import openobserveRum from '@salesforce/resourceUrl/datadog_rum_salesforce'
import { loadScript } from 'lightning/platformResourceLoader'

let datadogInitialization
let lastStartedUrl

const defaultInitConfiguration = {
  applicationId: 'xxx',
  clientToken: 'xxx',
  site: 'datadoghq.com',
  trackViewsManually: true,
}

export default class DatadogInit extends NavigationMixin(LightningElement) {
  @wire(CurrentPageReference)
  handleCurrentPageReference(pageReference) {
    if (!pageReference) {
      return
    }

    this.initialize()

    if (window.O2_RUM) {
      this.startViewForPageReference(pageReference)
    }
  }

  connectedCallback() {
    this.initialize()
  }

  startViewForPageReference(pageReference) {
    const urlPromise = this[NavigationMixin.GenerateUrl](pageReference)
    urlPromise.then((url) => {
      if (url === lastStartedUrl) {
        return
      }
      lastStartedUrl = url
      const absoluteUrl = new URL(url, window.location.origin).href
      window.O2_RUM.startView({ name: url, url: absoluteUrl })
    })
  }

  initialize() {
    if (!datadogInitialization) {
      datadogInitialization = this.loadDatadogRum()
    }
  }

  loadDatadogRum() {
    return loadScript(this, openobserveRum).then(() => {
      window.O2_RUM.setGlobalContext(window.RUM_CONTEXT)
      window.O2_RUM.init({ ...defaultInitConfiguration, ...window.RUM_CONFIGURATION })
      lastStartedUrl = window.location.pathname + window.location.search + window.location.hash
      window.O2_RUM.startView({
        name: lastStartedUrl,
        url: window.location.href,
      })
    })
  }
}
