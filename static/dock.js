// ── Dockable split view + draggable tabs ──────────────────────────────────
// Uses Sortable.js for tab reordering.
// Split: drag a session from the sidebar onto a drop zone → opens a second
// chat panel side-by-side. Each panel has its own tab bar and chat area.

(function(){
  'use strict';

  // ── Split state ──
  // S.splitPanels = [
  //   { id:'left',  sid: 'abc123', tabs: {}, activeTab: null },
  //   { id:'right', sid: 'def456', tabs: {}, activeTab: null }  // only if split
  // ]
  // For simplicity, the left panel reuses the existing #mainChat / #messages.
  // The right panel is a cloned DOM structure shown side-by-side.

  S.splitPanels = null;
  S.isSplit = false;

  // ── Tab reordering with Sortable.js ──
  function _initTabReorder(){
    const bar=document.getElementById('chatTabs');
    if(!bar||typeof Sortable==='undefined')return;
    if(bar._sortableInit)return;
    bar._sortableInit=true;
    Sortable.create(bar,{
      filter:'.chat-tab-add',
      draggable:'.chat-tab',
      animation:150,
      ghostClass:'chat-tab-ghost',
      onEnd:function(evt){
        if(evt.oldIndex===evt.newIndex||evt.oldIndex<0)return;
        // Reorder S.openTabs based on DOM order
        const tabEls=bar.querySelectorAll('.chat-tab');
        const newOrder={};
        tabEls.forEach(el=>{
          // Extract tabId from onclick attribute
          const onclick=el.getAttribute('onclick')||'';
          const m=onclick.match(/switchToTab\('([^']+)'\)|switchToFileTab\('([^']+)'\)/);
          const tabId=m?(m[1]||m[2]):null;
          if(tabId&&S.openTabs[tabId])newOrder[tabId]=S.openTabs[tabId];
        });
        S.openTabs=newOrder;
      }
    });
  }

  // ── Split view ──
  function toggleSplit(){
    if(S.isSplit){
      _closeSplit();
    }else{
      _openSplit();
    }
  }

  function _openSplit(){
    const mainChat=document.getElementById('mainChat');
    if(!mainChat)return;
    // Create right panel container
    let rightPanel=document.getElementById('splitRightPanel');
    if(!rightPanel){
      rightPanel=document.createElement('div');
      rightPanel.id='splitRightPanel';
      rightPanel.className='split-panel-right';
      rightPanel.innerHTML=
        '<div class="split-panel-tabs" id="splitRightTabs"></div>'+
        '<div class="split-panel-body" id="splitRightBody">'+
        '<div class="split-panel-empty">Drag a conversation here or click + to open</div>'+
        '</div>';
      mainChat.parentElement.insertBefore(rightPanel,mainChat.nextSibling);
    }
    mainChat.classList.add('split-active');
    rightPanel.style.display='flex';
    S.isSplit=true;
    // Init tab reorder on right panel too
    const rightTabs=document.getElementById('splitRightTabs');
    if(rightTabs&&typeof Sortable!=='undefined'&&!rightTabs._sortableInit){
      rightTabs._sortableInit=true;
      Sortable.create(rightTabs,{
        filter:'.chat-tab-add',
        draggable:'.chat-tab',
        animation:150,
        ghostClass:'chat-tab-ghost',
      });
    }
    // Init drop target on the right panel
    _initSplitDropTarget(rightPanel);
  }

  function _closeSplit(){
    const mainChat=document.getElementById('mainChat');
    const rightPanel=document.getElementById('splitRightPanel');
    if(mainChat)mainChat.classList.remove('split-active');
    if(rightPanel)rightPanel.style.display='none';
    S.isSplit=false;
  }

  // ── Drop target for split panel ──
  function _initSplitDropTarget(panel){
    if(panel._dropInit)return;
    panel._dropInit=true;
    panel.addEventListener('dragover',function(e){
      // Accept workspace file drags or session drags
      if(typeof _isWorkspaceTreeMoveDrag==='function'&&_isWorkspaceTreeMoveDrag(e)){
        e.preventDefault();e.stopPropagation();
        e.dataTransfer.dropEffect='copy';
        panel.classList.add('split-drag-over');
      }
    });
    panel.addEventListener('dragleave',function(){
      panel.classList.remove('split-drag-over');
    });
    panel.addEventListener('drop',function(e){
      panel.classList.remove('split-drag-over');
      if(typeof _isWorkspaceTreeMoveDrag==='function'&&_isWorkspaceTreeMoveDrag(e)){
        e.preventDefault();e.stopPropagation();
        const path=_wsDragSrcPath?_wsDragSrcPath(e):'';
        if(path){
          // Open file in this split panel
          _openInSplitPanel(panel,path,'file');
        }
      }
    });
  }

  function _openInSplitPanel(panel,path,type){
    const body=panel.querySelector('.split-panel-body')||panel.querySelector('#splitRightBody');
    const tabs=panel.querySelector('.split-panel-tabs')||panel.querySelector('#splitRightTabs');
    if(!body||!tabs)return;
    // Clear empty state
    body.innerHTML='';
    // Add tab
    const tabId=type==='file'?'file:'+path:path;
    const title=type==='file'?(path.split('/').pop()||path):'Chat';
    if(!S.openTabs[tabId+'-split']){
      S.openTabs[tabId+'-split']={type:type,title:title,path:path,sid:path};
    }
    // Render tab in the split panel's tab bar
    tabs.innerHTML='<div class="chat-tab active" onclick="switchToTab(\''+tabId+'\')"><span class="chat-tab-label">'+esc(title)+'</span><span class="chat-tab-close" onclick="event.stopPropagation();_closeSplit()"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span></div>';
    // Load file content into split body
    if(type==='file'&&typeof openArtifactPath==='function'){
      // For files, fetch and display content in the split body
      _loadFileInSplitBody(body,path);
    }
  }

  async function _loadFileInSplitBody(body,path){
    body.innerHTML='<div style="padding:20px;color:var(--muted);font-size:13px">Loading '+esc(path)+'...</div>';
    try{
      const resp=await fetch('api/file?path='+encodeURIComponent(path)+(S.session?'&session_id='+encodeURIComponent(S.session.session_id):''));
      if(!resp.ok)throw new Error('HTTP '+resp.status);
      const text=await resp.text();
      // Simple code display
      const ext=path.split('.').pop().toLowerCase();
      if(['md','markdown'].includes(ext)&&typeof renderMd==='function'){
        body.innerHTML='<div class="split-preview-md">'+renderMd(text)+'</div>';
      }else{
        body.innerHTML='<pre class="split-preview-code"><code>'+esc(text)+'</code></pre>';
      }
    }catch(e){
      body.innerHTML='<div style="padding:20px;color:var(--error,#e05);font-size:13px">Failed to load: '+esc(e.message)+'</div>';
    }
  }

  // ── Session drag from sidebar → split ──
  // Make session items draggable
  function _initSessionDrag(){
    const sessionList=document.getElementById('sessionList');
    if(!sessionList||sessionList._dragInit)return;
    sessionList._dragInit=true;
    // Use event delegation — session items are re-rendered frequently
    sessionList.addEventListener('dragstart',function(e){
      const item=e.target.closest('[data-session-id],.session-item');
      if(!item)return;
      const sid=item.dataset.sessionId||item.getAttribute('data-sid')||'';
      if(!sid)return;
      e.dataTransfer.setData('application/session-id',sid);
      e.dataTransfer.setData('text/plain',sid);
      e.dataTransfer.effectAllowed='copy';
    });
  }

  // ── Init on DOM ready ──
  function _init(){
    _initTabReorder();
    _initSessionDrag();
    // Re-init tab reorder after renderChatTabs recreates the bar content
    const originalRender=window.renderChatTabs;
    if(originalRender){
      window.renderChatTabs=function(){
        originalRender.apply(this,arguments);
        _initTabReorder();
      };
    }
  }
  if(document.readyState==='complete'||document.readyState==='interactive'){
    _init();
  }else{
    document.addEventListener('DOMContentLoaded',_init,{once:true});
  }

  // Expose globals
  window.toggleSplit=toggleSplit;
  window._closeSplit=_closeSplit;
})();