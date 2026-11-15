/**
 * @innovatorved/code-lab — Workbench SVG Icon Registry (VS Code Codicon + Seti File Icons)
 * Uniform 24x24 Activity Bar Codicons, 16x16 Action Codicons, and colored Seti file icons.
 */

export const CL_ICONS: Record<string, string> = {
  // ── 24x24 Activity Bar Codicons ────────────────────────────────────────────
  activityExplorer:
    '<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15.5 3H8.5A1.5 1.5 0 0 0 7 4.5v13A1.5 1.5 0 0 0 8.5 19h10a1.5 1.5 0 0 0 1.5-1.5V7.5L15.5 3Z"/><path d="M15 3v5h5"/><path d="M4 7.5v12A1.5 1.5 0 0 0 5.5 21H16"/></svg>',
  activitySearch:
    '<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="10.5" r="6.5"/><line x1="15.5" y1="15.5" x2="20.5" y2="20.5"/></svg>',
  activityScm:
    '<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="6" r="2.25"/><circle cx="7" cy="18" r="2.25"/><circle cx="17" cy="8" r="2.25"/><line x1="7" y1="8.25" x2="7" y2="15.75"/><path d="M17 10.25v1.25a3.5 3.5 0 0 1-3.5 3.5H7"/></svg>',
  activityRun:
    '<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="9 5 20 12 9 19 9 5"/><circle cx="5.5" cy="16.5" r="2.5"/><path d="M5.5 11.5v2.5"/><path d="M3 16.5h.5"/></svg>',
  activityExtensions:
    '<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/><rect x="13.5" y="13.5" width="7" height="7" rx="1"/><rect x="14.5" y="2.5" width="6.5" height="6.5" rx="1" transform="rotate(12 17.75 5.75)"/></svg>',
  activityGuided:
    '<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5v-13A2.5 2.5 0 0 1 6.5 3Z"/><line x1="9" y1="8" x2="16" y2="8"/><line x1="9" y1="12" x2="14" y2="12"/></svg>',
  activityAccount:
    '<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="9.5" r="3"/><path d="M6.8 18.5a6.5 6.5 0 0 1 10.4 0"/></svg>',
  activitySettings:
    '<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',

  // ── 16x16 Workbench Action & Chrome Codicons ───────────────────────────────
  arrowLeft:
    '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="13" y1="8" x2="3" y2="8"/><polyline points="7 12 3 8 7 4"/></svg>',
  arrowRight:
    '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="8" x2="13" y2="8"/><polyline points="9 4 13 8 9 12"/></svg>',
  target:
    '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/></svg>',
  code:
    '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  play:
    '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M4.5 2.75l8.5 5.25-8.5 5.25V2.75z"/></svg>',
  stop:
    '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="3.5" y="3.5" width="9" height="9" rx="1"/></svg>',
  check:
    '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="13.5 4.5 6.5 11.5 2.5 7.5"/></svg>',
  lightbulb:
    '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>',
  list:
    '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
  book:
    '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  file:
    '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 1.5H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5L9.5 1.5Z"/><polyline points="9.5 1.5 9.5 5 13 5"/></svg>',
  newFile:
    '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 1.5H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5L9.5 1.5Z"/><polyline points="9.5 1.5 9.5 5 13 5"/><line x1="8" y1="7.5" x2="8" y2="11.5"/><line x1="6" y1="9.5" x2="10" y2="9.5"/></svg>',
  newFolder:
    '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M14 12.5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3.3l1.4 1.8H13a1 1 0 0 1 1 1v7.2Z"/><line x1="8" y1="7" x2="8" y2="11"/><line x1="6" y1="9" x2="10" y2="9"/></svg>',
  terminal:
    '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2.5 11.5 6.5 8 2.5 4.5"/><line x1="8" y1="12" x2="13.5" y2="12"/></svg>',
  database:
    '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
  globe:
    '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  package:
    '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m16.5 9.4-9-5.19"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/></svg>',
  chevronsUpDown:
    '<svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>',
  chevronDown:
    '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 6 8 10 12 6"/></svg>',
  chevronRight:
    '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 4 10 8 6 12"/></svg>',
  chevronUp:
    '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="12 10 8 6 4 10"/></svg>',
  folder:
    '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="#dcb67a"><path d="M14.5 4H7.71l-.85-.85A.5.5 0 0 0 6.5 3h-5a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5v-8a.5.5 0 0 0-.5-.5Z"/></svg>',
  folderOpen:
    '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="#dcb67a"><path d="M1.5 3A.5.5 0 0 0 1 3.5v9a.5.5 0 0 0 .5.5h12.2a.5.5 0 0 0 .48-.36l1.3-4.5A.5.5 0 0 0 15 7.5H3.3L2 12V4h4.3l.85.85c.1.1.22.15.35.15h6.5V4.5a.5.5 0 0 0-.5-.5H7.71l-.85-.85A.5.5 0 0 0 6.5 3h-5Z"/></svg>',
  plus:
    '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/></svg>',
  minus:
    '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="3" y1="8" x2="13" y2="8"/></svg>',
  discard:
    '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="5.5 3.5 2.5 6.5 5.5 9.5"/><path d="M2.5 6.5h6.5a4 4 0 1 1 0 8H6"/></svg>',
  edit:
    '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M11.5 2.5a1.5 1.5 0 0 1 2.1 2.1L5.5 12.7 2.5 13.5l.8-3L11.5 2.5Z"/></svg>',
  trash:
    '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="2.5 4 13.5 4"/><path d="M12 4v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4m2 0V2.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5V4"/></svg>',
  clearAll:
    '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><line x1="2" y1="4" x2="12" y2="4"/><line x1="4" y1="8" x2="14" y2="8"/><line x1="6" y1="12" x2="13" y2="12"/></svg>',
  more:
    '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><circle cx="3.5" cy="8" r="1.2"/><circle cx="8" cy="8" r="1.2"/><circle cx="12.5" cy="8" r="1.2"/></svg>',
  box:
    '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/></svg>',
  search:
    '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="7" cy="7" r="4.5"/><line x1="10.5" y1="10.5" x2="14" y2="14"/></svg>',
  diff:
    '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2.5" width="5" height="11" rx="0.8"/><rect x="9" y="2.5" width="5" height="11" rx="0.8"/></svg>',
  splitHorizontal:
    '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="2.5" width="13" height="11" rx="1"/><line x1="8" y1="2.5" x2="8" y2="13.5"/></svg>',
  splitVertical:
    '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="2.5" width="13" height="11" rx="1"/><line x1="1.5" y1="8" x2="14.5" y2="8"/></svg>',
  command:
    '<svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/></svg>',
  download:
    '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 10.5v2.5a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-2.5"/><polyline points="5 7.5 8 10.5 11 7.5"/><line x1="8" y1="10.5" x2="8" y2="2"/></svg>',
  refresh:
    '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 3v3.5H10"/><path d="M2.5 13V9.5H6"/><path d="M3.2 6A5.2 5.2 0 0 1 12 4.3L13.5 6.5M2.5 9.5L4 11.7A5.2 5.2 0 0 0 12.8 10"/></svg>',
  send:
    '<svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
  activity:
    '<svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
  radio:
    '<svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/></svg>',
  monitor:
    '<svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
  tablet:
    '<svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>',
  smartphone:
    '<svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2" width="10" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>',
  externalLink:
    '<svg aria-hidden="true" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h4"/><polyline points="10 2 14 2 14 6"/><line x1="7" y1="9" x2="14" y2="2"/></svg>',
  x:
    '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="12" y1="4" x2="4" y2="12"/><line x1="4" y1="4" x2="12" y2="12"/></svg>',
  close:
    '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="12" y1="4" x2="4" y2="12"/><line x1="4" y1="4" x2="12" y2="12"/></svg>',
  warning:
    '<svg aria-hidden="true" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7.15 2.5a1 1 0 0 1 1.7 0l5.4 9.5a1 1 0 0 1-.85 1.5H2.6a1 1 0 0 1-.85-1.5l5.4-9.5Z"/><line x1="8" y1="6.5" x2="8" y2="9.5"/><circle cx="8" cy="11.5" r="0.5" fill="currentColor"/></svg>',
  errorCircle:
    '<svg aria-hidden="true" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="8" cy="8" r="6"/><line x1="10" y1="6" x2="6" y2="10"/><line x1="6" y1="6" x2="10" y2="10"/></svg>',
  bell:
    '<svg aria-hidden="true" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6A4 4 0 0 0 4 6c0 4.5-2 5.5-2 5.5h12S12 10.5 12 6Z"/><path d="M6.8 13.5a1.4 1.4 0 0 0 2.4 0"/></svg>',
  clock:
    '<svg aria-hidden="true" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><polyline points="8 4.5 8 8 10.5 9.5"/></svg>',
  memory:
    '<svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 19v2"/><path d="M10 19v2"/><path d="M14 19v2"/><path d="M18 19v2"/><path d="M6 3v2"/><path d="M10 3v2"/><path d="M14 3v2"/><path d="M18 3v2"/><rect x="2" y="5" width="20" height="14" rx="2"/></svg>',
  keyboard:
    '<svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01"/><path d="M10 8h.01"/><path d="M14 8h.01"/><path d="M18 8h.01"/><path d="M6 12h.01"/><path d="M10 12h.01"/><path d="M14 12h.01"/><path d="M18 12h.01"/><path d="M7 16h10"/></svg>',
  share:
    '<svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',
  layout:
    '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="2" width="13" height="12" rx="1"/><line x1="1.5" y1="6" x2="14.5" y2="6"/><line x1="6" y1="14" x2="6" y2="6"/></svg>',
  maximize:
    '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="12 10 8 6 4 10"/></svg>',
  settings:
    '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  files:
    '<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15.5 3H8.5A1.5 1.5 0 0 0 7 4.5v13A1.5 1.5 0 0 0 8.5 19h10a1.5 1.5 0 0 0 1.5-1.5V7.5L15.5 3Z"/><path d="M15 3v5h5"/><path d="M4 7.5v12A1.5 1.5 0 0 0 5.5 21H16"/></svg>',
  gitBranch:
    '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="4.5" cy="3.5" r="1.7"/><circle cx="4.5" cy="12.5" r="1.7"/><circle cx="11.5" cy="5.5" r="1.7"/><line x1="4.5" y1="5.2" x2="4.5" y2="10.8"/><path d="M11.5 7.2v.8a2.5 2.5 0 0 1-2.5 2.5H4.5"/></svg>',
  sidebarLeft:
    '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="2" width="13" height="12" rx="1"/><line x1="5.5" y1="2" x2="5.5" y2="14"/></svg>',
  panelBottom:
    '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="2" width="13" height="12" rx="1"/><line x1="1.5" y1="10" x2="14.5" y2="10"/></svg>',
  sidebarRight:
    '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="2" width="13" height="12" rx="1"/><line x1="10.5" y1="2" x2="10.5" y2="14"/></svg>',
  collapseAll:
    '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="3.5" width="9" height="9" rx="1"/><path d="M6.5 2h6a1 1 0 0 1 1 1v6"/><line x1="5" y1="8" x2="9" y2="8"/></svg>',
  symbolFunction:
    '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#c084fc" stroke-width="1.4"><rect x="2" y="2" width="12" height="12" rx="2"/><path d="M9.5 5.5H8a1 1 0 0 0-1 1v5M6 8h3.5"/></svg>',
  symbolClass:
    '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#fb923c" stroke-width="1.4"><circle cx="5" cy="8" r="2.2"/><circle cx="11.5" cy="5" r="1.8"/><circle cx="11.5" cy="11" r="1.8"/><line x1="7" y1="7" x2="9.8" y2="5.6"/><line x1="7" y1="9" x2="9.8" y2="10.4"/></svg>',
  symbolVariable:
    '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#a1a1aa" stroke-width="1.4"><rect x="2" y="3.5" width="12" height="9" rx="1.5"/><path d="M6 6.5l2 3 2-3"/></svg>'
};

function badgeSvg(bg: string, fg: string, text: string, fontSize = 7.2): string {
  return `<svg class="codelab-seti-icon" aria-hidden="true" width="16" height="16" viewBox="0 0 16 16"><rect x="1.5" y="1.5" width="13" height="13" rx="2.2" fill="${bg}"/><text x="8" y="11" text-anchor="middle" fill="${fg}" font-family="'Geist',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="${fontSize}" font-weight="700">${text}</text></svg>`;
}

/**
 * Returns a colored 16x16 Seti-style SVG icon matching VS Code's file icon theme.
 */
export function getFileIconSvg(filename: string, isOpenFolder?: boolean): string {
  if (isOpenFolder !== undefined) {
    return isOpenFolder ? CL_ICONS.folderOpen : CL_ICONS.folder;
  }
  const base = (filename.split('/').pop() || filename).toLowerCase();
  if (base === 'package.json' || base === 'package-lock.json') {
    return badgeSvg('#cb3837', '#ffffff', 'npm', 5.8);
  }
  if (base === 'tsconfig.json' || base === 'jsconfig.json' || base.startsWith('tsconfig.')) {
    return badgeSvg('#3178c6', '#ffffff', 'TS', 7);
  }
  if (base === 'dockerfile' || base.startsWith('dockerfile.')) {
    return badgeSvg('#2496ed', '#ffffff', 'DK', 6.5);
  }
  if (base === '.gitignore' || base === '.gitattributes' || base === '.gitmodules') {
    return `<svg class="codelab-seti-icon" aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#f14e32" stroke-width="1.5"><circle cx="8" cy="8" r="5.5"/><line x1="8" y1="4.5" x2="8" y2="11.5"/><circle cx="8" cy="8" r="1.5" fill="#f14e32"/></svg>`;
  }

  const dotIdx = base.lastIndexOf('.');
  const ext = dotIdx >= 0 ? base.slice(dotIdx + 1) : '';
  switch (ext) {
    case 'ts':
    case 'mts':
    case 'cts':
      return badgeSvg('#3178c6', '#ffffff', 'TS', 7);
    case 'tsx':
      return `<svg class="codelab-seti-icon" aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="1.6" fill="#61dafb"/><ellipse cx="8" cy="8" rx="6" ry="2.4" stroke="#61dafb" stroke-width="1.1"/><ellipse cx="8" cy="8" rx="6" ry="2.4" stroke="#61dafb" stroke-width="1.1" transform="rotate(60 8 8)"/><ellipse cx="8" cy="8" rx="6" ry="2.4" stroke="#61dafb" stroke-width="1.1" transform="rotate(120 8 8)"/></svg>`;
    case 'js':
    case 'mjs':
    case 'cjs':
      return badgeSvg('#f1e05a', '#1f1f1f', 'JS', 7);
    case 'jsx':
      return `<svg class="codelab-seti-icon" aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="1.6" fill="#00d8ff"/><ellipse cx="8" cy="8" rx="6" ry="2.4" stroke="#00d8ff" stroke-width="1.1"/><ellipse cx="8" cy="8" rx="6" ry="2.4" stroke="#00d8ff" stroke-width="1.1" transform="rotate(60 8 8)"/><ellipse cx="8" cy="8" rx="6" ry="2.4" stroke="#00d8ff" stroke-width="1.1" transform="rotate(120 8 8)"/></svg>`;
    case 'json':
    case 'jsonc':
      return `<svg class="codelab-seti-icon" aria-hidden="true" width="16" height="16" viewBox="0 0 16 16"><text x="8" y="11.5" text-anchor="middle" fill="#cbcb41" font-family="'Geist Mono',ui-monospace,monospace" font-size="11" font-weight="700">{}</text></svg>`;
    case 'py':
    case 'pyi':
      return badgeSvg('#3572a5', '#ffd43b', 'PY', 7);
    case 'cpp':
    case 'cc':
    case 'cxx':
      return badgeSvg('#00599c', '#ffffff', 'C+', 6.8);
    case 'c':
      return badgeSvg('#555555', '#a8b9cc', 'C', 8);
    case 'h':
    case 'hpp':
    case 'hxx':
      return badgeSvg('#68217a', '#ffffff', 'H', 8);
    case 'sql':
    case 'sqlite':
    case 'db':
      return `<svg class="codelab-seti-icon" aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#e38c00" stroke-width="1.3"><ellipse cx="8" cy="3.8" rx="5.2" ry="2"/><path d="M13.2 8c0 1.1-2.3 2-5.2 2S2.8 9.1 2.8 8"/><path d="M2.8 3.8v8.4c0 1.1 2.3 2 5.2 2s5.2-.9 5.2-2V3.8"/></svg>`;
    case 'md':
    case 'mdx':
      return `<svg class="codelab-seti-icon" aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#519aba" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="3" width="13" height="10" rx="1.2"/><path d="M4 10.5v-5l2 2.5 2-2.5v5"/><path d="M11.2 5.5v5m-1.5-1.5 1.5 1.5 1.5-1.5"/></svg>`;
    case 'html':
    case 'htm':
    case 'astro':
      return `<svg class="codelab-seti-icon" aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#e34c26" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 4.5 1.8 8 5 11.5"/><polyline points="11 4.5 14.2 8 11 11.5"/><line x1="9.2" y1="3.5" x2="6.8" y2="12.5"/></svg>`;
    case 'css':
      return badgeSvg('#563d7c', '#ffffff', '#', 9);
    case 'scss':
    case 'sass':
      return badgeSvg('#c6538c', '#ffffff', 'S', 8);
    case 'less':
      return badgeSvg('#1d365d', '#ffffff', 'L', 8);
    case 'sh':
    case 'bash':
    case 'zsh':
      return `<svg class="codelab-seti-icon" aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#89e051" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 11 6.5 8 3 5"/><line x1="8" y1="11.5" x2="13" y2="11.5"/></svg>`;
    case 'yml':
    case 'yaml':
    case 'toml':
      return `<svg class="codelab-seti-icon" aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#cb171e" stroke-width="1.4" stroke-linecap="round"><line x1="3" y1="4.5" x2="10" y2="4.5"/><line x1="5" y1="8" x2="13" y2="8"/><line x1="5" y1="11.5" x2="11" y2="11.5"/></svg>`;
    case 'svg':
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'webp':
    case 'gif':
      return `<svg class="codelab-seti-icon" aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#a074c4" stroke-width="1.3" stroke-linejoin="round"><rect x="2" y="2.5" width="12" height="11" rx="1.2"/><circle cx="5.5" cy="6" r="1.1" fill="#a074c4"/><path d="M2.5 12l3.5-3.5 2.5 2.5 2-2 3 3"/></svg>`;
    case 'wasm':
    case 'out':
      return badgeSvg('#654ff0', '#ffffff', 'WA', 6);
    default:
      return CL_ICONS.file;
  }
}
