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

export default class ExperienceDatadogInit extends NavigationMixin(LightningElement) {
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
    this[NavigationMixin.GenerateUrl](pageReference).then((url) => {
      if (url === lastStartedUrl) {
        return
      }
      lastStartedUrl = url
      window.O2_RUM.startView({
        name: url,
        url: new URL(url, window.location.origin).href,
      })
    })
  }

  initialize() {
    if (new URLSearchParams(window.location.search).get('init') !== 'true' || datadogInitialization) {
      return
    }

    datadogInitialization = this.loadDatadogRum()
  }

  loadDatadogRum() {
    return loadScript(this, openobserveRum).then(() => {
      if (window.RUM_CONTEXT) {
        window.O2_RUM.setGlobalContext(window.RUM_CONTEXT)
      }
      window.O2_RUM.init({ ...defaultInitConfiguration, ...window.RUM_CONFIGURATION })
      lastStartedUrl = window.location.pathname + window.location.search + window.location.hash
      window.O2_RUM.startView({
        name: lastStartedUrl,
        url: window.location.href,
      })
    })
  }
}
