// ── Chat tabs bar (VSCode-style editor tabs) ──────────────────────────────────
// Tracks which sessions are "open" as tabs. Does NOT cache message content —
// switching to a tab reloads the session from the server via loadSession().
// Keeps a lightweight map: sid -> { title }
if(typeof S!=='undefined' && !S.openTabs){
  S.openTabs = {};  // sid -> { title }
}

// Order in which tabs were opened, so re-renders keep a stable left-to-right layout.
if(typeof window!=='undefined' && !window._chatTabOrder){
  window._chatTabOrder = [];
}

function _chatTabEscapeLabel(s){
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function _chatTabTruncate(title, max){
  max = max || 30;
  var s = String(title || '');
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function renderChatTabs(){
  var bar = document.getElementById('chatTabs');
  if(!bar) return;
  var activeSid = (S && S.session) ? S.session.session_id : null;
  var html = '';
  var order = window._chatTabOrder || [];
  for(var i = 0; i < order.length; i++){
    var sid = order[i];
    var tab = S.openTabs[sid];
    if(!tab) continue;
    var active = (sid === activeSid) ? ' active' : '';
    var label = _chatTabEscapeLabel(_chatTabTruncate(tab.title || 'Untitled'));
    html += '<div class="chat-tab' + active + '" data-sid="' + _chatTabEscapeLabel(sid) + '" onclick="chatTabClick(\'' + _chatTabEscapeLabel(sid) + '\')">'
      + '<span class="chat-tab-label" title="' + _chatTabEscapeLabel(tab.title || 'Untitled') + '">' + label + '</span>'
      + '<button class="chat-tab-close" type="button" aria-label="Close tab" onclick="event.stopPropagation();chatTabClose(\'' + _chatTabEscapeLabel(sid) + '\')">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
      + '</button>'
      + '</div>';
  }
  // + button to open a new chat
  html += '<button class="chat-tab-new" type="button" aria-label="New chat" title="New chat" onclick="chatTabNewChat()">'
    + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'
    + '</button>';
  bar.innerHTML = html;
}

function _chatTabAdd(sid, title){
  if(!sid) return;
  if(!S.openTabs){
    S.openTabs = {};
  }
  if(!S.openTabs[sid]){
    S.openTabs[sid] = { title: title || 'Untitled' };
    if(!window._chatTabOrder) window._chatTabOrder = [];
    if(window._chatTabOrder.indexOf(sid) === -1){
      window._chatTabOrder.push(sid);
    }
  } else if(title){
    S.openTabs[sid].title = title;
  }
  renderChatTabs();
}

function _chatTabRemove(sid){
  if(!sid || !S.openTabs) return;
  delete S.openTabs[sid];
  if(window._chatTabOrder){
    var idx = window._chatTabOrder.indexOf(sid);
    if(idx !== -1) window._chatTabOrder.splice(idx, 1);
  }
  renderChatTabs();
}

function chatTabClick(sid){
  if(!sid) return;
  var activeSid = (S && S.session) ? S.session.session_id : null;
  if(sid === activeSid) return;  // already viewing
  if(typeof loadSession === 'function'){
    loadSession(sid);
  }
}

function chatTabClose(sid){
  if(!sid) return;
  _chatTabRemove(sid);
  var activeSid = (S && S.session) ? S.session.session_id : null;
  if(sid === activeSid){
    // Closing the active tab — switch to the next available tab, or start a new chat.
    var remaining = window._chatTabOrder || [];
    if(remaining.length > 0){
      if(typeof loadSession === 'function') loadSession(remaining[remaining.length - 1]);
    } else {
      // No tabs left — start fresh
      chatTabNewChat();
    }
  }
}

function chatTabNewChat(){
  var btn = document.getElementById('btnNewChat');
  if(btn) btn.click();
}

// Sync hook: called from loadSession/newSession success paths to register/update the tab.
function _syncChatTabFromSession(){
  if(!S || !S.session) return;
  var sid = S.session.session_id;
  var title = S.session.title || 'Untitled';
  _chatTabAdd(sid, title);
}

// Patch into existing session-loading flow by wrapping syncTopbar, which is
// called after both loadSession() and newSession() succeed. This keeps the
// approach minimal — no need to modify sessions.js directly.
(function(){
  if(typeof syncTopbar === 'function' && !syncTopbar._tabsPatched){
    var origSyncTopbar = syncTopbar;
    syncTopbar = function(){
      origSyncTopbar.apply(this, arguments);
      try { _syncChatTabFromSession(); } catch(_){}
    };
    syncTopbar._tabsPatched = true;
  }
})();