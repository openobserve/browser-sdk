import { Anchor, Button, Divider, Group, Space, Text } from '@mantine/core'
import type { ReactNode } from 'react'
import React from 'react'
import { evalInWindow } from '../../evalInWindow'
import { useSdkInfos } from '../../hooks/useSdkInfos'
import { Columns } from '../columns'
import { Json } from '../json'
import { TabBase } from '../tabBase'
import { createLogger } from '../../../common/logger'

const logger = createLogger('infosTab')

export function InfosTab() {
  const infos = useSdkInfos()
  if (!infos) {
    return null
  }
  const sessionId = infos.cookie?.id

  return (
    <TabBase>
      <Columns>
        <Columns.Column title="Session">
          {infos.cookie && (
            <>
              <Entry name="Id" value={infos.cookie.id} />
              <Entry name="Logs" value={formatSessionType(infos.cookie.logs, 'Not tracked', 'Tracked')} />
              <Entry
                name="RUM"
                value={formatSessionType(
                  infos.cookie.rum,
                  'Not tracked',
                  'Tracked with Session Replay',
                  'Tracked without Session Replay'
                )}
              />
              <Entry name="Created" value={formatDate(Number(infos.cookie.created))} />
              <Entry name="Expire" value={formatDate(Number(infos.cookie.expire))} />
              <Space h="sm" />
              <Button color="violet" variant="light" onClick={endSession} className="dd-privacy-allow">
                End current session
              </Button>
            </>
          )}
        </Columns.Column>
        <Columns.Column title="RUM">
          {infos.rum && (
            <>
              {sessionId && (
                <Group className="dd-privacy-allow">
                  <AppLink
                    config={infos.rum.config}
                    path="rum/explorer"
                    params={{
                      query: `@session.id:${sessionId}`,
                      live: 'true',
                    }}
                  >
                    Explorer
                  </AppLink>
                  <Divider sx={{ height: '24px' }} orientation="vertical" />
                  <AppLink config={infos.rum.config} path={`rum/replay/sessions/${sessionId}`} params={{}}>
                    Session Replay
                  </AppLink>
                </Group>
              )}
              <Entry name="Version" value={infos.rum.version} />
              <Entry name="Configuration" value={infos.rum.config} />
              <Entry name="Internal context" value={infos.rum.internalContext} />
              <Entry name="Global context" value={infos.rum.globalContext} />
              <Entry name="User" value={infos.rum.user} />
            </>
          )}
        </Columns.Column>
        <Columns.Column title="Logs">
          {infos.logs && (
            <>
              {sessionId && (
                <div className="dd-privacy-allow">
                  <AppLink
                    config={infos.logs.config}
                    path="logs"
                    params={{
                      query: `source:browser @session_id:${sessionId}`,
                    }}
                  >
                    Explorer
                  </AppLink>
                </div>
              )}
              <Entry name="Version" value={infos.logs.version} />
              <Entry name="Configuration" value={infos.logs.config} />
              <Entry name="Global context" value={infos.logs.globalContext} />
              <Entry name="User" value={infos.logs.user} />
            </>
          )}
        </Columns.Column>
      </Columns>
    </TabBase>
  )
}

function AppLink({
  config,
  path,
  params,
  children,
}: {
  config?: { site?: string }
  path: string
  params: { [key: string]: string }
  children: ReactNode
}) {
  const site = config?.site ?? 'api.openobserve.ai'
  const hostname = site;
  return (
    <Anchor href={`https://${hostname}/${path}?${new URLSearchParams(params).toString()}`} target="_blank">
      {children}
    </Anchor>
  )
}

function Entry({ name, value }: { name: string; value: any }) {
  return (
    <Text size="sm" component="div">
      {typeof value === 'string' ? (
        <>
          {name}: {value}
        </>
      ) : value ? (
        <>
          {name}: <Json name="" src={value} collapsed={1} />
        </>
      ) : (
        <>{name}: (empty)</>
      )}
    </Text>
  )
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString('en-US')
}

function formatSessionType(value: string, ...labels: string[]) {
  const index = Number(value)
  return !isNaN(index) && index >= 0 && index < labels.length ? labels[index] : value
}

function endSession() {
  evalInWindow(
    `
      document.cookie = '_oo_s=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
    `
  ).catch((error) => logger.error('Error while ending session:', error))
}
