import type {
  ImapAttachment,
  ImapFolder,
  ImapMessageDetail,
  ImapMessageSummary,
} from '../../../utils/webmail';

export type {
  ImapAttachment,
  ImapFolder,
  ImapMessageDetail,
  ImapMessageSummary,
};

export type ComposeMode = 'new' | 'reply' | 'replyAll' | 'forward';
export type FilterTab = 'all' | 'unread' | 'starred';

export type ComposeNotice = {
  type: 'ok' | 'err';
  text: string;
};

export type DiagnosticsData = {
  email: string;
  domain: string;
  nameServers?: string[];
  connectedImapServer: string;
  connectedImapIp: string;
  rootDomainIps: string[];
  mailSubdomainIps: string[];
  mxRecords: {
    exchange: string;
    priority: number;
    ips: string[];
    isCloudflareProxy: boolean;
  }[];
  googleMxDetails?: { exchange: string; priority: number; ips: string[] }[];
  cloudflareMxDetails?: { exchange: string; priority: number; ips: string[] }[];
  port25Sim?: { reachable: boolean; accepted: boolean; transcript: string };
  spfRecord: string | null;
  mxPointingToCpanel: boolean;
  warning?: string;
  foldersSummary?: { path: string; total: number; unseen: number }[];
  selfTestResult?: { ok: boolean; detail: string };
};
