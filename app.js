(() => {
  const cfg = window.CLOUT_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const qsa = (s) => [...document.querySelectorAll(s)];
  const modal = $('walletModal');
  const status = $('walletStatus');
  let walletAddress = localStorage.getItem('clout_eth_wallet') || '';
  let walletProvider = localStorage.getItem('clout_wallet_provider') || '';

  const short = (a) => a ? `${a.slice(0,6)}…${a.slice(-4)}` : '';
  function setWalletButton() {
    const b = $('connectWallet');
    if (walletAddress) b.textContent = short(walletAddress);
    else b.textContent = 'Connect wallet';
  }
  function openModal(){ modal.classList.add('open'); modal.setAttribute('aria-hidden','false'); status.textContent=''; }
  function closeModal(){ modal.classList.remove('open'); modal.setAttribute('aria-hidden','true'); }
  qsa('[data-close]').forEach(el=>el.addEventListener('click', closeModal));
  $('connectWallet').addEventListener('click', openModal);
  $('checkPosition').addEventListener('click', () => walletAddress ? alert(`Holder position connected to ${short(walletAddress)}. Live CLOUT ownership will load from the Ethereum holder API once the token contract is configured.`) : openModal());

  async function authenticate(provider, address, providerName) {
    walletAddress = address;
    walletProvider = providerName;
    localStorage.setItem('clout_eth_wallet', address);
    localStorage.setItem('clout_wallet_provider', providerName);
    setWalletButton();
    if (!cfg.apiBase) { closeModal(); return; }
    try {
      status.textContent = 'Creating secure holder challenge…';
      const c = await fetch(`${cfg.apiBase}/v1/public/holder/challenge`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({walletAddress:address})});
      if (!c.ok) throw new Error(c.status === 404 ? 'Holder auth route is not deployed on Railway yet.' : `Challenge failed (${c.status})`);
      const ch = await c.json();
      status.textContent = 'Confirm the sign-in message in your wallet…';
      const signature = await provider.request({method:'personal_sign',params:[ch.message,address]});
      const v = await fetch(`${cfg.apiBase}/v1/public/holder/verify`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({challengeId:ch.challengeId,walletAddress:address,signature})});
      if (!v.ok) throw new Error(`Wallet verification failed (${v.status})`);
      const verified = await v.json();
      localStorage.setItem('clout_holder_session', JSON.stringify({sessionToken:verified.sessionToken,walletAddress:verified.walletAddress||address,expiresAt:verified.expiresAt}));
      status.textContent = 'Connected.';
      setTimeout(closeModal,450);
    } catch (e) {
      status.textContent = e.message || 'Wallet connection failed.';
    }
  }

  async function injectedConnect(preferred) {
    const eth = window.ethereum;
    if (!eth) throw new Error(`${preferred} was not detected in this browser.`);
    const accounts = await eth.request({method:'eth_requestAccounts'});
    if (!accounts?.[0]) throw new Error('No Ethereum account was returned.');
    const chainId = await eth.request({method:'eth_chainId'}).catch(()=>null);
    if (chainId && parseInt(chainId,16) !== Number(cfg.chainId||1)) {
      await eth.request({method:'wallet_switchEthereumChain',params:[{chainId:'0x1'}]}).catch(()=>{});
    }
    await authenticate(eth, accounts[0], preferred.toLowerCase());
  }

  $('metaMaskChoice').addEventListener('click', async()=>{ try { status.textContent='Opening MetaMask…'; await injectedConnect('MetaMask'); } catch(e){ status.textContent=e.message; }});
  $('robinhoodChoice').addEventListener('click', async()=>{
    try {
      if (window.ethereum) { status.textContent='Opening Robinhood Wallet…'; await injectedConnect('Robinhood'); return; }
      if (!cfg.walletConnectProjectId) throw new Error('Robinhood Wallet on desktop needs a WalletConnect project ID in config.js. Inside the Robinhood Wallet browser, connect again and it will use the injected provider.');
      status.textContent='Loading WalletConnect…';
      const mod = await import('https://esm.sh/@walletconnect/ethereum-provider@2.23.6');
      const Provider = mod.EthereumProvider;
      const p = await Provider.init({projectId:cfg.walletConnectProjectId,chains:[Number(cfg.chainId||1)],showQrModal:true,metadata:{name:'CLOUT Studios',description:'CLOUT holder access',url:location.origin,icons:[`${location.origin}${location.pathname.replace(/[^/]*$/,'')}assets/clout.svg`]}});
      await p.connect();
      const accounts = p.accounts || [];
      if (!accounts[0]) throw new Error('Robinhood Wallet returned no account.');
      await authenticate(p, accounts[0], 'robinhood');
    } catch(e){ status.textContent=e.message || 'Robinhood Wallet connection failed.'; }
  });

  qsa('.payout-option').forEach(btn=>btn.addEventListener('click',()=>{qsa('.payout-option').forEach(x=>x.classList.remove('active'));btn.classList.add('active');localStorage.setItem('clout_payout_preference',btn.dataset.pref);}));
  const pref=localStorage.getItem('clout_payout_preference'); if(pref){const b=document.querySelector(`[data-pref="${pref}"]`);if(b)b.click();}

  const usdToEth = 1/3500;
  const usdToRobux = 80;
  function applyCurrency(cur){qsa('[data-money]').forEach(el=>{const usd=Number(el.dataset.money||0); if(cur==='USD')el.textContent=`$${usd.toLocaleString()}`; else if(cur==='ETH')el.textContent=`${(usd*usdToEth).toFixed(4)} ETH`; else el.textContent=`${Math.round(usd*usdToRobux).toLocaleString()} R$`;});}
  qsa('.currency-toggle button').forEach(btn=>btn.addEventListener('click',()=>{qsa('.currency-toggle button').forEach(x=>x.classList.remove('active'));btn.classList.add('active');applyCurrency(btn.dataset.currency);}));

  async function loadContent(){
    if(!cfg.apiBase) return;
    try{
      const r=await fetch(`${cfg.apiBase}/v1/public/content`); if(!r.ok)return; const d=await r.json();
      const u=d?.updates||[]; if(u.length){const g=$('updatesGrid');g.className='update-list';g.innerHTML=u.slice(0,6).map((x,i)=>`<article class="update-card"><small>${escapeHtml(x.category||'STUDIO')}</small><h3>${escapeHtml(x.title||'Update')}</h3><p>${escapeHtml(x.summary||'')}</p></article>`).join('');}
    }catch{}
  }
  function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)e.target.classList.add('visible')}),{threshold:.08});qsa('.reveal').forEach(e=>io.observe(e));
  setWalletButton(); loadContent();
})();
