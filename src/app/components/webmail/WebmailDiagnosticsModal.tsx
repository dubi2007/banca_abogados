'use client';

import { ExternalLink, Loader2, Send, Server, X } from 'lucide-react';
import type { DiagnosticsData } from './types';

type Props = {
  diagLoading: boolean;
  diagData: DiagnosticsData | null;
  onClose: () => void;
  onRunSelfTest: () => void;
};

export default function WebmailDiagnosticsModal({
  diagLoading,
  diagData,
  onClose,
  onRunSelfTest,
}: Props) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/65 p-4"
    >
      <div className="my-auto w-full max-w-2xl border border-line bg-paper shadow-2xl">
        <div className="flex items-center justify-between border-b border-line bg-ink-deep px-5 py-3.5 text-white">
          <div className="flex items-center gap-2">
            <Server size={17} className="text-gold" />
            <h2 className="font-serif text-lg text-white">
              Diagnóstico de Recepción de Correos (cPanel &amp; DNS MX)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer text-white/80 hover:text-gold"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[82dvh] space-y-4 overflow-y-auto p-5 text-xs leading-relaxed text-ink">
          {diagLoading && !diagData ? (
            <div className="flex items-center justify-center py-10 text-ink-muted">
              <Loader2 size={20} className="mr-2 animate-spin text-gold-dark" />
              <span>Analizando servidor cPanel y registros DNS MX del dominio...</span>
            </div>
          ) : diagData ? (
            <>
              <div className="grid gap-3 border border-line bg-parchment p-3.5 sm:grid-cols-2">
                <div>
                  <p className="font-semibold text-ink-muted uppercase">Buzón conectado</p>
                  <p className="mt-0.5 font-medium text-ink">{diagData.email}</p>
                </div>
                <div>
                  <p className="font-semibold text-ink-muted uppercase">
                    Servidor cPanel IMAP real
                  </p>
                  <p className="mt-0.5 font-medium text-ink">
                    {diagData.connectedImapServer} (IP:{' '}
                    <strong className="text-gold-dark">{diagData.connectedImapIp}</strong>)
                  </p>
                </div>
                {diagData.nameServers && diagData.nameServers.length > 0 && (
                  <div className="sm:col-span-2">
                    <p className="font-semibold text-ink-muted uppercase">
                      Servidores DNS autoritativos (Nameservers donde debes editar el MX)
                    </p>
                    <p className="mt-0.5 font-mono text-ink">
                      {diagData.nameServers.join(' • ')}
                    </p>
                  </div>
                )}
              </div>

              {/* MX Analysis */}
              <div className="border border-line p-4">
                <h3 className="font-serif text-base text-ink">
                  1. ¿A dónde está enviando Gmail los correos de @{diagData.domain}? (Registros MX)
                </h3>
                <div className="mt-2 grid gap-2 border border-line bg-parchment/40 p-2.5 text-[11px] sm:grid-cols-2">
                  <div>
                    <strong>IP de {diagData.domain} (Web Vercel):</strong>{' '}
                    <code>{diagData.rootDomainIps.join(', ') || 'N/A'}</code>
                  </div>
                  <div>
                    <strong>IP de mail.{diagData.domain}:</strong>{' '}
                    <code
                      className={
                        diagData.mailSubdomainIps.includes(diagData.connectedImapIp)
                          ? 'font-bold text-emerald-800'
                          : 'font-bold text-red-800'
                      }
                    >
                      {diagData.mailSubdomainIps.join(', ') || 'No existe registro A'}
                    </code>
                  </div>
                </div>
                {diagData.mxRecords.length === 0 ? (
                  <div className="mt-2 border border-red-800/30 bg-red-950/5 p-3 text-red-900">
                    <strong>Problema detectado:</strong> El dominio{' '}
                    <code>{diagData.domain}</code> no tiene ningún registro <strong>MX</strong>{' '}
                    configurado en su DNS público.
                  </div>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {diagData.mxRecords.map((mx) => (
                      <li key={mx.exchange} className="border border-line bg-parchment/50 p-2.5">
                        <div>
                          <strong>Servidor MX (Prioridad {mx.priority}):</strong>{' '}
                          <code>{mx.exchange}</code> &rarr; IP:{' '}
                          <code>{mx.ips.join(', ') || 'Sin IP (No existe registro A)'}</code>
                        </div>
                        {mx.isCloudflareProxy && (
                          <p className="mt-1 font-medium text-red-800">
                            ⚠️ Este registro MX pasa por el Proxy de Cloudflare (nube naranja).
                          </p>
                        )}
                        {!mx.isCloudflareProxy && !mx.ips.includes(diagData.connectedImapIp) && (
                          <p className="mt-1 font-medium text-amber-900">
                            ⚠️ Atención: El registro MX apunta a la IP{' '}
                            <code>{mx.ips.join(', ') || 'ninguna'}</code>, pero tu servidor cPanel
                            tiene la IP <code>{diagData.connectedImapIp}</code>.
                          </p>
                        )}
                        {!mx.isCloudflareProxy && mx.ips.includes(diagData.connectedImapIp) && (
                          <p className="mt-1 font-medium text-emerald-800">
                            ✓ El registro MX apunta correctamente a la IP de tu servidor cPanel (
                            {diagData.connectedImapIp}).
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {diagData.googleMxDetails && (
                  <div className="mt-3 border border-line bg-parchment/60 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-ink">
                        ¿Qué ve Google DNS (8.8.8.8 / Gmail) en su caché ahora mismo?
                      </p>
                      <a
                        href={`https://dns.google/cache?domain=${encodeURIComponent(diagData.domain)}&type=MX`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-gold-dark underline"
                      >
                        <span>Limpiar caché MX de Google (Flush Cache)</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                    {diagData.googleMxDetails.length === 0 ? (
                      <p className="mt-1 text-amber-900">
                        Google DNS aún no reporta el nuevo MX en caché.
                      </p>
                    ) : (
                      <ul className="mt-1.5 space-y-1">
                        {diagData.googleMxDetails.map((gmx) => (
                          <li key={`gmx-${gmx.exchange}`}>
                            <code>{gmx.exchange}</code> &rarr; IP en Google DNS:{' '}
                            <code
                              className={
                                gmx.ips.includes(diagData.connectedImapIp)
                                  ? 'font-bold text-emerald-800'
                                  : 'font-bold text-red-800'
                              }
                            >
                              {gmx.ips.join(', ') || 'Sin IP'}
                            </code>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {diagData.cloudflareMxDetails && (
                  <div className="mt-2 border border-line bg-parchment/40 p-3">
                    <p className="font-semibold text-ink">
                      ¿Qué ve Cloudflare DNS (1.1.1.1) ahora mismo?
                    </p>
                    <ul className="mt-1 space-y-1">
                      {diagData.cloudflareMxDetails.map((cmx) => (
                        <li key={`cmx-${cmx.exchange}-${cmx.priority}`}>
                          Prioridad {cmx.priority}: <code>{cmx.exchange}</code> &rarr; IP:{' '}
                          <code
                            className={
                              cmx.ips.includes(diagData.connectedImapIp)
                                ? 'font-bold text-emerald-800'
                                : 'font-bold text-red-800'
                            }
                          >
                            {cmx.ips.join(', ') || 'Sin IP'}
                          </code>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {diagData.port25Sim && (
                  <div className="mt-2 border border-line bg-parchment/40 p-3">
                    <p className="font-semibold text-ink">
                      Simulación de entrada en puerto 25 de cPanel (simulando entrega desde Gmail):
                    </p>
                    <p
                      className={`mt-1 font-semibold ${
                        diagData.port25Sim.accepted ? 'text-emerald-800' : 'text-red-800'
                      }`}
                    >
                      {diagData.port25Sim.accepted
                        ? '✓ El servidor cPanel (198.58.106.39:25) ACEPTÓ el correo entrante externo.'
                        : '⚠️ Respuesta del puerto 25 de cPanel:'}
                    </p>
                    <pre className="mt-1.5 max-h-36 overflow-x-auto bg-ink-deep p-2.5 font-mono text-[11px] text-white/90">
                      {diagData.port25Sim.transcript}
                    </pre>
                  </div>
                )}
              </div>

              {/* Folders summary on the server */}
              <div className="border border-line p-4">
                <h3 className="font-serif text-base text-ink">
                  2. Mensajes existentes actualmente en tu servidor cPanel
                </h3>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {diagData.foldersSummary?.map((f) => (
                    <div key={f.path} className="border border-line bg-parchment/40 p-2">
                      <p className="truncate font-semibold text-ink">{f.path}</p>
                      <p className="text-ink-muted">
                        {f.total} total ({f.unseen} sin leer)
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Self-test button */}
              <div className="border border-line bg-parchment/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-serif text-base text-ink">
                      3. Prueba de entrega interna en cPanel
                    </h3>
                    <p className="text-ink-muted">
                      Envía un correo de prueba desde tu propio servidor hacia {diagData.email} para
                      verificar si cPanel entrega correos locales en tu Bandeja de entrada.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={diagLoading}
                    onClick={onRunSelfTest}
                    className="button-primary cursor-pointer px-4 py-2 text-xs disabled:opacity-50"
                  >
                    {diagLoading ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Probando...</span>
                      </>
                    ) : (
                      <>
                        <Send size={14} />
                        <span>Enviar correo de prueba a mi buzón</span>
                      </>
                    )}
                  </button>
                </div>

                {diagData.selfTestResult && (
                  <div
                    className={`mt-3 border p-3 ${
                      diagData.selfTestResult.ok
                        ? 'border-emerald-700/30 bg-emerald-950/5 text-emerald-900'
                        : 'border-red-800/30 bg-red-950/5 text-red-900'
                    }`}
                  >
                    {diagData.selfTestResult.detail}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
