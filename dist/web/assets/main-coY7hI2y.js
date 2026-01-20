(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))i(s);new MutationObserver(s=>{for(const n of s)if(n.type==="childList")for(const a of n.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&i(a)}).observe(document,{childList:!0,subtree:!0});function t(s){const n={};return s.integrity&&(n.integrity=s.integrity),s.referrerPolicy&&(n.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?n.credentials="include":s.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function i(s){if(s.ep)return;s.ep=!0;const n=t(s);fetch(s.href,n)}})();const I="/api";class F{constructor(){this.token=localStorage.getItem("auth_token")}setToken(e){this.token=e,e?localStorage.setItem("auth_token",e):localStorage.removeItem("auth_token")}getToken(){return this.token}isAuthenticated(){return!!this.token}async request(e,t,i=null){const s={"Content-Type":"application/json"};this.token&&(s.Authorization=`Bearer ${this.token}`);const n={method:e,headers:s};i&&e!=="GET"&&(n.body=JSON.stringify(i));const a=await fetch(`${I}${t}`,n);if(a.status===401)throw this.setToken(null),window.dispatchEvent(new CustomEvent("auth:logout")),new Error("Unauthorized");if(!a.ok){const c=await a.json().catch(()=>({message:"Request failed"}));throw new Error(c.message||"Request failed")}return a.json()}async login(e,t){const i=await this.request("POST","/auth/login",{username:e,password:t});return this.setToken(i.token),i}async verifyToken(){try{return await this.request("GET","/auth/verify"),!0}catch{return!1}}logout(){this.setToken(null),window.dispatchEvent(new CustomEvent("auth:logout"))}async listBrains(){return(await this.request("GET","/brains")).brains}async getBrain(e){return(await this.request("GET",`/brains/${e}`)).brain}async createBrain(e){return(await this.request("POST","/brains",e)).brain}async updateBrain(e,t){return(await this.request("PUT",`/brains/${e}`,t)).brain}async deleteBrain(e){await this.request("DELETE",`/brains/${e}`)}async addNeuron(e,t){return(await this.request("POST",`/brains/${e}/neurons`,t)).neuron}async updateNeuron(e,t,i){return(await this.request("PUT",`/brains/${e}/neurons/${t}`,i)).neuron}async deleteNeuron(e,t){await this.request("DELETE",`/brains/${e}/neurons/${t}`)}async addConnection(e,t){return(await this.request("POST",`/brains/${e}/connections`,t)).connection}async deleteConnection(e,t){await this.request("DELETE",`/brains/${e}/connections/${t}`)}async startExecution(e,t={}){return(await this.request("POST",`/brains/${e}/execute`,t)).execution}async getExecution(e){return(await this.request("GET",`/executions/${e}`)).execution}async pauseExecution(e){return this.request("POST",`/executions/${e}/pause`)}async resumeExecution(e){return this.request("POST",`/executions/${e}/resume`)}async stepExecution(e){return this.request("POST",`/executions/${e}/step`)}async sendInput(e,t,i="text"){return this.request("POST",`/executions/${e}/input`,{content:t,type:i})}getExecutionStreamUrl(e){return`${window.location.protocol==="https:"?"wss:":"ws:"}//${window.location.host}/api/executions/${e}/stream`}}const h=new F;function z(r){let e={...r};const t=new Set;return{getState(){return e},setState(i){const s=e;e={...e,...i};for(const n of t)n(e,s)},subscribe(i){return t.add(i),()=>{t.delete(i)}},reset(){this.setState(r)}}}const p=z({isAuthenticated:!1,user:null,currentView:"login",currentBrainId:null,currentExecId:null,brains:[],currentBrain:null,selectedNeuronId:null,execution:null,isExecuting:!1,isLoading:!1,error:null});function k(r,e=null){p.setState({isAuthenticated:r,user:e,currentView:r?"brains":"login"})}function N(r){p.setState({currentBrain:r,currentBrainId:(r==null?void 0:r.id)||null,selectedNeuronId:null})}function B(r){p.setState({selectedNeuronId:r})}function R(r,e={}){p.setState({currentView:r,...e})}class ${constructor(){this.routes=new Map,this.currentRoute=null,this.params={},window.addEventListener("hashchange",()=>this.handleRoute())}register(e,t){return this.routes.set(e,t),this}navigate(e,t={}){let i=e;for(const[s,n]of Object.entries(t))i=i.replace(`:${s}`,n);window.location.hash=i}getPath(){return window.location.hash.slice(1)||"/"}handleRoute(){const e=this.getPath();for(const[t,i]of this.routes){const s=this.matchRoute(t,e);if(s){this.currentRoute=t,this.params=s.params,i(s.params);return}}this.navigate("/")}matchRoute(e,t){const i=e.split("/"),s=t.split("/");if(i.length!==s.length)return null;const n={};for(let a=0;a<i.length;a++){const c=i[a],o=s[a];if(c.startsWith(":"))n[c.slice(1)]=o;else if(c!==o)return null}return{params:n}}getParams(){return this.params}start(){this.handleRoute()}}const d=new $;d.register("/",()=>{window.dispatchEvent(new CustomEvent("route:home"))}).register("/login",()=>{window.dispatchEvent(new CustomEvent("route:login"))}).register("/brains",()=>{window.dispatchEvent(new CustomEvent("route:brains"))}).register("/brains/:id",r=>{window.dispatchEvent(new CustomEvent("route:brain",{detail:r}))}).register("/brains/:id/edit",r=>{window.dispatchEvent(new CustomEvent("route:editor",{detail:r}))}).register("/brains/:id/chat",r=>{window.dispatchEvent(new CustomEvent("route:chat",{detail:r}))}).register("/brains/:id/live",r=>{window.dispatchEvent(new CustomEvent("route:live",{detail:r}))}).register("/brains/:id/live/:execId",r=>{window.dispatchEvent(new CustomEvent("route:live",{detail:r}))});class D extends HTMLElement{constructor(){super(),this.attachShadow({mode:"open"})}connectedCallback(){this.render(),this.setupListeners(),this.checkAuth()}setupListeners(){p.subscribe(e=>{this.updateView(e)}),window.addEventListener("route:home",()=>{p.getState().isAuthenticated?d.navigate("/brains"):d.navigate("/login")}),window.addEventListener("route:login",()=>{R("login")}),window.addEventListener("route:brains",()=>{if(!p.getState().isAuthenticated){d.navigate("/login");return}R("brains")}),window.addEventListener("route:editor",e=>{if(!p.getState().isAuthenticated){d.navigate("/login");return}R("editor",{currentBrainId:e.detail.id})}),window.addEventListener("route:chat",e=>{if(!p.getState().isAuthenticated){d.navigate("/login");return}R("chat",{currentBrainId:e.detail.id})}),window.addEventListener("route:live",e=>{if(!p.getState().isAuthenticated){d.navigate("/login");return}R("live",{currentBrainId:e.detail.id,currentExecId:e.detail.execId||null})}),window.addEventListener("auth:logout",()=>{k(!1),d.navigate("/login")}),d.start()}async checkAuth(){h.isAuthenticated()&&await h.verifyToken()?(k(!0),(d.getPath()==="/"||d.getPath()==="/login")&&d.navigate("/brains")):d.navigate("/login")}updateView(e){const t=this.shadowRoot.querySelector(".content");if(t)switch(t.innerHTML="",e.currentView){case"login":t.innerHTML="<login-form></login-form>";break;case"brains":t.innerHTML=this.renderBrainsView();break;case"editor":t.innerHTML=`<brain-editor brain-id="${e.currentBrainId}"></brain-editor>`;break;case"chat":t.innerHTML=`<chat-view brain-id="${e.currentBrainId}"></chat-view>`;break;case"live":t.innerHTML=`<live-view brain-id="${e.currentBrainId}" exec-id="${e.currentExecId||""}"></live-view>`;break;default:t.innerHTML="<login-form></login-form>"}}renderBrainsView(){return`
      <div class="app-container">
        <header class="app-header">
          <div class="app-header__logo">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 2a10 10 0 0 1 0 20"/>
              <circle cx="12" cy="12" r="4"/>
            </svg>
            <span>WormsBatsAndFlies</span>
          </div>
          <div class="app-header__actions">
            <button class="btn btn--ghost" id="logout-btn">Logout</button>
          </div>
        </header>
        <main class="app-main">
          <aside class="app-sidebar">
            <div class="app-sidebar__header">
              <h2>Brains</h2>
              <button class="btn btn--primary btn--sm" id="new-brain-btn">+ New</button>
            </div>
            <div class="app-sidebar__content">
              <brain-list></brain-list>
            </div>
          </aside>
          <div class="app-content">
            <div class="empty-state">
              <svg class="empty-state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 2a10 10 0 0 1 0 20"/>
                <circle cx="12" cy="12" r="4"/>
                <line x1="12" y1="8" x2="12" y2="6"/>
                <line x1="12" y1="18" x2="12" y2="16"/>
                <line x1="8" y1="12" x2="6" y2="12"/>
                <line x1="18" y1="12" x2="16" y2="12"/>
              </svg>
              <h3 class="empty-state__title">Select a Brain</h3>
              <p class="empty-state__description">Choose a brain from the sidebar or create a new one to get started.</p>
            </div>
          </div>
        </main>
      </div>
    `}render(){this.shadowRoot.innerHTML=`
      <style>
        @import '/css/reset.css';
        @import '/css/variables.css';
        @import '/css/layout.css';
        @import '/css/components.css';

        :host {
          display: block;
          height: 100vh;
        }

        .content {
          height: 100%;
        }
      </style>
      <div class="content"></div>
    `,this.shadowRoot.addEventListener("click",e=>{e.target.id==="logout-btn"&&h.logout(),e.target.id==="new-brain-btn"&&this.createNewBrain()})}async createNewBrain(){try{const e=await h.createBrain({name:"New Brain",description:"A new neural network",neurons:[{name:"Input",type:"text_input",systemPrompt:"You receive user input and pass it to the network.",model:"openai/gpt-4o-mini",memoryLength:5,position:{x:0,y:0,z:0},color:"#3b82f6"},{name:"Output",type:"text_output",systemPrompt:"You generate the final response based on inputs from other neurons.",model:"openai/gpt-4o-mini",memoryLength:5,position:{x:3,y:0,z:0},color:"#22c55e"}],connections:[]});window.dispatchEvent(new CustomEvent("brains:refresh")),d.navigate(`/brains/${e.id}/edit`)}catch(e){console.error("Failed to create brain:",e)}}}customElements.define("app-shell",D);class U extends HTMLElement{constructor(){super(),this.attachShadow({mode:"open"}),this.brains=[]}connectedCallback(){this.render(),this.loadBrains(),window.addEventListener("brains:refresh",()=>this.loadBrains()),p.subscribe(e=>{this.updateSelection(e.currentBrainId)})}async loadBrains(){try{this.brains=await h.listBrains(),this.renderBrains()}catch(e){console.error("Failed to load brains:",e)}}updateSelection(e){this.shadowRoot.querySelectorAll(".brain-item").forEach(i=>{i.dataset.id===e?i.classList.add("list-item--active"):i.classList.remove("list-item--active")})}renderBrains(){const e=this.shadowRoot.querySelector(".brain-list");if(!e)return;if(this.brains.length===0){e.innerHTML=`
        <div class="empty">
          <p>No brains yet.</p>
          <p>Create one to get started!</p>
        </div>
      `;return}const t=p.getState().currentBrainId;e.innerHTML=this.brains.map(i=>{var s;return`
      <div class="brain-item list-item ${i.id===t?"list-item--active":""}" data-id="${i.id}">
        <div class="list-item__icon">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </div>
        <div class="list-item__content">
          <div class="list-item__title">${this.escapeHtml(i.name)}</div>
          <div class="list-item__subtitle">${((s=i.neurons)==null?void 0:s.length)||0} neurons</div>
        </div>
        <div class="brain-actions">
          <button class="btn btn--ghost btn--icon edit-btn" data-id="${i.id}" title="Edit">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="btn btn--ghost btn--icon chat-btn" data-id="${i.id}" title="Chat">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </button>
          <button class="btn btn--ghost btn--icon delete-btn" data-id="${i.id}" title="Delete">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>
    `}).join("")}escapeHtml(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}render(){this.shadowRoot.innerHTML=`
      <style>
        @import '/css/variables.css';
        @import '/css/components.css';

        :host {
          display: block;
        }

        .brain-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
        }

        .brain-item {
          position: relative;
        }

        .brain-actions {
          display: none;
          gap: var(--space-1);
        }

        .brain-item:hover .brain-actions {
          display: flex;
        }

        .empty {
          padding: var(--space-4);
          text-align: center;
          color: var(--color-text-muted);
          font-size: var(--text-sm);
        }

        .empty p {
          margin-bottom: var(--space-2);
        }
      </style>
      <div class="brain-list">
        <div class="empty">
          <div class="spinner"></div>
          <p>Loading brains...</p>
        </div>
      </div>
    `,this.shadowRoot.addEventListener("click",e=>{const t=e.target.closest(".brain-item"),i=e.target.closest(".edit-btn"),s=e.target.closest(".chat-btn"),n=e.target.closest(".delete-btn");n?(e.stopPropagation(),this.deleteBrain(n.dataset.id)):i?(e.stopPropagation(),d.navigate(`/brains/${i.dataset.id}/edit`)):s?(e.stopPropagation(),d.navigate(`/brains/${s.dataset.id}/chat`)):t&&d.navigate(`/brains/${t.dataset.id}/edit`)})}async deleteBrain(e){if(confirm("Are you sure you want to delete this brain?"))try{await h.deleteBrain(e),this.brains=this.brains.filter(t=>t.id!==e),this.renderBrains(),p.getState().currentBrainId===e&&(N(null),d.navigate("/brains"))}catch(t){console.error("Failed to delete brain:",t)}}}customElements.define("brain-list",U);class H extends HTMLElement{constructor(){super(),this.attachShadow({mode:"open"})}connectedCallback(){this.render(),this.setupForm()}setupForm(){const e=this.shadowRoot.querySelector("form"),t=this.shadowRoot.querySelector(".form-error");e.addEventListener("submit",async i=>{i.preventDefault(),t.textContent="";const s=e.username.value.trim(),n=e.password.value;if(!s||!n){t.textContent="Please enter username and password";return}const a=e.querySelector('button[type="submit"]');a.disabled=!0,a.innerHTML='<span class="spinner"></span> Logging in...';try{await h.login(s,n),k(!0,{username:s}),d.navigate("/brains")}catch(c){t.textContent=c.message||"Login failed",a.disabled=!1,a.textContent="Login"}})}render(){this.shadowRoot.innerHTML=`
      <style>
        @import '/css/reset.css';
        @import '/css/variables.css';
        @import '/css/layout.css';
        @import '/css/components.css';

        :host {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background-color: var(--color-bg-primary);
        }

        .login-card {
          width: 100%;
          max-width: 400px;
          background-color: var(--color-bg-secondary);
          border-radius: var(--radius-lg);
          padding: var(--space-8);
          box-shadow: var(--shadow-lg);
        }

        .logo {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-3);
          margin-bottom: var(--space-8);
        }

        .logo svg {
          color: var(--color-primary);
        }

        .logo-text {
          font-size: var(--text-xl);
          font-weight: 600;
        }

        h1 {
          text-align: center;
          font-size: var(--text-2xl);
          margin-bottom: var(--space-2);
        }

        .subtitle {
          text-align: center;
          color: var(--color-text-secondary);
          margin-bottom: var(--space-6);
        }

        .form-error {
          min-height: 1.5em;
          margin-bottom: var(--space-4);
        }

        button[type="submit"] {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-2);
        }

        .spinner {
          width: 16px;
          height: 16px;
          border-width: 2px;
        }

        .footer {
          margin-top: var(--space-6);
          text-align: center;
          color: var(--color-text-muted);
          font-size: var(--text-xs);
        }
      </style>

      <div class="login-card">
        <div class="logo">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 2a10 10 0 0 1 0 20"/>
            <circle cx="12" cy="12" r="4"/>
          </svg>
          <span class="logo-text">WormsBatsAndFlies</span>
        </div>

        <h1>Welcome Back</h1>
        <p class="subtitle">Sign in to continue to your neural networks</p>

        <form>
          <div class="form-error"></div>

          <div class="form-group">
            <label class="form-label" for="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              class="input"
              placeholder="Enter your username"
              autocomplete="username"
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              class="input"
              placeholder="Enter your password"
              autocomplete="current-password"
              required
            />
          </div>

          <button type="submit" class="btn btn--primary btn--lg">
            Login
          </button>
        </form>

        <p class="footer">
          LLM Orchestration System inspired by Neal Stephenson's Anathem
        </p>
      </div>
    `}}customElements.define("login-form",H);class q extends HTMLElement{static get observedAttributes(){return["brain-id"]}constructor(){super(),this.attachShadow({mode:"open"}),this.brain=null}connectedCallback(){this.render(),this.loadBrain()}attributeChangedCallback(e,t,i){e==="brain-id"&&t!==i&&this.loadBrain()}async loadBrain(){const e=this.getAttribute("brain-id");if(e)try{this.brain=await h.getBrain(e),N(this.brain),this.updateEditor()}catch(t){console.error("Failed to load brain:",t)}}updateEditor(){if(!this.brain)return;const e=this.shadowRoot.querySelector(".editor-header h2");e&&(e.textContent=this.brain.name);const t=this.shadowRoot.querySelector("webgl-canvas");t&&t.setBrain(this.brain);const i=this.shadowRoot.querySelector("neuron-panel");i&&i.setBrain(this.brain)}async addNeuron(){if(this.brain)try{const e=await h.addNeuron(this.brain.id,{name:`Neuron ${this.brain.neurons.length+1}`,type:"regular",systemPrompt:"You process information and generate insights.",model:"openai/gpt-4o-mini",memoryLength:5,position:{x:Math.random()*4-2,y:Math.random()*4-2,z:Math.random()*4-2},color:this.getRandomColor()});this.brain.neurons.push(e),this.updateEditor(),B(e.id)}catch(e){console.error("Failed to add neuron:",e)}}getRandomColor(){const e=["#f43f5e","#ec4899","#a855f7","#6366f1","#3b82f6","#06b6d4","#10b981","#84cc16"];return e[Math.floor(Math.random()*e.length)]}async saveBrain(){if(this.brain)try{await h.updateBrain(this.brain.id,{name:this.brain.name,description:this.brain.description,neurons:this.brain.neurons,connections:this.brain.connections,textInputNeuronId:this.brain.textInputNeuronId,textOutputNeuronId:this.brain.textOutputNeuronId,pictureInputNeuronId:this.brain.pictureInputNeuronId,defaultStepDelayMs:this.brain.defaultStepDelayMs}),window.dispatchEvent(new CustomEvent("brains:refresh"))}catch(e){console.error("Failed to save brain:",e)}}render(){this.shadowRoot.innerHTML=`
      <style>
        @import '/css/reset.css';
        @import '/css/variables.css';
        @import '/css/layout.css';
        @import '/css/components.css';

        :host {
          display: block;
          height: 100%;
        }

        .editor-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          background-color: var(--color-bg-primary);
        }

        .editor-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-4) var(--space-6);
          background-color: var(--color-bg-secondary);
          border-bottom: 1px solid var(--color-border);
        }

        .editor-header h2 {
          font-size: var(--text-lg);
          font-weight: 600;
        }

        .editor-header__actions {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .editor-content {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        .editor-canvas {
          flex: 1;
          position: relative;
        }

        .editor-panel {
          width: var(--panel-width);
          border-left: 1px solid var(--color-border);
          background-color: var(--color-bg-secondary);
        }

        .toolbar {
          position: absolute;
          bottom: var(--space-4);
          left: 50%;
          transform: translateX(-50%);
          z-index: 10;
        }
      </style>

      <div class="editor-container">
        <header class="editor-header">
          <h2>Loading...</h2>
          <div class="editor-header__actions">
            <button class="btn btn--secondary" id="chat-btn">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              Chat
            </button>
            <button class="btn btn--secondary" id="live-btn">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Run
            </button>
            <button class="btn btn--primary" id="save-btn">Save</button>
          </div>
        </header>
        <div class="editor-content">
          <div class="editor-canvas">
            <webgl-canvas></webgl-canvas>
            <div class="toolbar">
              <button class="btn btn--secondary" id="add-neuron-btn">+ Add Neuron</button>
              <span class="toolbar__divider"></span>
              <button class="btn btn--ghost btn--icon" id="reset-camera-btn" title="Reset Camera">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                  <path d="M3 3v5h5"/>
                </svg>
              </button>
            </div>
          </div>
          <aside class="editor-panel">
            <neuron-panel></neuron-panel>
          </aside>
        </div>
      </div>
    `,this.shadowRoot.getElementById("add-neuron-btn").addEventListener("click",()=>this.addNeuron()),this.shadowRoot.getElementById("save-btn").addEventListener("click",()=>this.saveBrain()),this.shadowRoot.getElementById("chat-btn").addEventListener("click",()=>{this.brain&&d.navigate(`/brains/${this.brain.id}/chat`)}),this.shadowRoot.getElementById("live-btn").addEventListener("click",()=>{this.brain&&d.navigate(`/brains/${this.brain.id}/live`)}),this.shadowRoot.getElementById("reset-camera-btn").addEventListener("click",()=>{const e=this.shadowRoot.querySelector("webgl-canvas");e&&e.resetCamera()})}}customElements.define("brain-editor",q);class V extends HTMLElement{constructor(){super(),this.attachShadow({mode:"open"}),this.brain=null,this.selectedNeuron=null}connectedCallback(){this.render(),p.subscribe(e=>{var t;e.selectedNeuronId!==(((t=this.selectedNeuron)==null?void 0:t.id)||null)&&this.selectNeuron(e.selectedNeuronId)})}setBrain(e){this.brain=e,this.selectNeuron(p.getState().selectedNeuronId)}selectNeuron(e){this.brain&&(this.selectedNeuron=e?this.brain.neurons.find(t=>t.id===e):null,this.updatePanel())}updatePanel(){const e=this.shadowRoot.querySelector(".panel-content");if(e){if(!this.selectedNeuron){e.innerHTML=this.renderEmptyState();return}e.innerHTML=this.renderNeuronForm(),this.setupFormListeners()}}renderEmptyState(){return`
      <div class="empty-state">
        <svg class="empty-state__icon" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        <p class="empty-state__title">No Neuron Selected</p>
        <p class="empty-state__description">Click on a neuron to edit its properties</p>
      </div>
    `}renderNeuronForm(){const e=this.selectedNeuron,t=[{id:"openai/gpt-4o-mini",name:"GPT-4o Mini"},{id:"openai/gpt-4o",name:"GPT-4o"},{id:"anthropic/claude-3.5-sonnet",name:"Claude 3.5 Sonnet"},{id:"anthropic/claude-3-haiku",name:"Claude 3 Haiku"},{id:"meta-llama/llama-3.1-70b-instruct",name:"Llama 3.1 70B"},{id:"google/gemini-pro-1.5",name:"Gemini Pro 1.5"}],i=[{id:"regular",name:"Regular"},{id:"text_input",name:"Text Input"},{id:"picture_input",name:"Picture Input"},{id:"text_output",name:"Text Output"}];return`
      <form class="neuron-form">
        <div class="form-group">
          <label class="form-label">Name</label>
          <input type="text" name="name" class="input" value="${this.escapeHtml(e.name)}" />
        </div>

        <div class="form-group">
          <label class="form-label">Type</label>
          <select name="type" class="input select">
            ${i.map(s=>`
              <option value="${s.id}" ${e.type===s.id?"selected":""}>${s.name}</option>
            `).join("")}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Model</label>
          <select name="model" class="input select">
            ${t.map(s=>`
              <option value="${s.id}" ${e.model===s.id?"selected":""}>${s.name}</option>
            `).join("")}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Color</label>
          <div class="color-picker">
            <input type="color" name="color" class="color-input" value="${e.color||"#6366f1"}" />
            <span class="color-value">${e.color||"#6366f1"}</span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Memory Length: ${e.memoryLength}</label>
          <input type="range" name="memoryLength" class="slider" min="1" max="20" value="${e.memoryLength}" />
        </div>

        <div class="form-group">
          <label class="form-label">Temperature: ${e.temperature||.7}</label>
          <input type="range" name="temperature" class="slider" min="0" max="2" step="0.1" value="${e.temperature||.7}" />
        </div>

        <div class="form-group">
          <label class="form-label">System Prompt</label>
          <textarea name="systemPrompt" class="input textarea" rows="6">${this.escapeHtml(e.systemPrompt)}</textarea>
        </div>

        <div class="form-group">
          <label class="form-label">Connections</label>
          <div class="connections-list">
            ${this.renderConnections()}
          </div>
          <button type="button" class="btn btn--secondary btn--sm" id="add-connection-btn">+ Add Connection</button>
        </div>

        <div class="form-actions">
          <button type="button" class="btn btn--secondary" id="delete-neuron-btn">Delete Neuron</button>
        </div>
      </form>
    `}renderConnections(){if(!this.brain||!this.selectedNeuron)return"";const e=this.brain.connections.filter(t=>t.sourceNeuronId===this.selectedNeuron.id);return e.length===0?'<p class="no-connections">No outgoing connections</p>':e.map(t=>{const i=this.brain.neurons.find(s=>s.id===t.targetNeuronId);return`
        <div class="connection-item">
          <span>→ ${i?this.escapeHtml(i.name):"Unknown"}</span>
          <button type="button" class="btn btn--ghost btn--icon delete-connection-btn" data-id="${t.id}">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      `}).join("")}escapeHtml(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}setupFormListeners(){const e=this.shadowRoot.querySelector(".neuron-form");if(!e)return;e.addEventListener("change",n=>{this.handleFieldChange(n.target.name,n.target.value)}),e.addEventListener("input",n=>{if(n.target.tagName==="INPUT"&&n.target.type==="range"){const a=n.target.closest(".form-group").querySelector(".form-label"),c=n.target.name;a.textContent=`${c.charAt(0).toUpperCase()+c.slice(1)}: ${n.target.value}`}});const t=e.querySelector("#delete-neuron-btn");t==null||t.addEventListener("click",()=>this.deleteNeuron());const i=e.querySelector("#add-connection-btn");i==null||i.addEventListener("click",()=>this.showConnectionDialog()),e.querySelectorAll(".delete-connection-btn").forEach(n=>{n.addEventListener("click",()=>this.deleteConnection(n.dataset.id))});const s=e.querySelector('input[name="color"]');s==null||s.addEventListener("input",n=>{const a=e.querySelector(".color-value");a&&(a.textContent=n.target.value)})}async handleFieldChange(e,t){if(!this.brain||!this.selectedNeuron)return;e==="memoryLength"&&(t=parseInt(t)),e==="temperature"&&(t=parseFloat(t)),this.selectedNeuron[e]=t;const i=this.brain.neurons.findIndex(s=>s.id===this.selectedNeuron.id);i>=0&&(this.brain.neurons[i]=this.selectedNeuron),window.dispatchEvent(new CustomEvent("neuron:updated",{detail:this.selectedNeuron}))}async deleteNeuron(){if(!(!this.brain||!this.selectedNeuron)&&confirm("Are you sure you want to delete this neuron?"))try{await h.deleteNeuron(this.brain.id,this.selectedNeuron.id),this.brain.neurons=this.brain.neurons.filter(e=>e.id!==this.selectedNeuron.id),this.brain.connections=this.brain.connections.filter(e=>e.sourceNeuronId!==this.selectedNeuron.id&&e.targetNeuronId!==this.selectedNeuron.id),B(null),window.dispatchEvent(new CustomEvent("brain:updated",{detail:this.brain}))}catch(e){console.error("Failed to delete neuron:",e)}}async deleteConnection(e){if(this.brain)try{await h.deleteConnection(this.brain.id,e),this.brain.connections=this.brain.connections.filter(t=>t.id!==e),this.updatePanel(),window.dispatchEvent(new CustomEvent("brain:updated",{detail:this.brain}))}catch(t){console.error("Failed to delete connection:",t)}}showConnectionDialog(){if(!this.brain||!this.selectedNeuron)return;const e=this.brain.neurons.filter(i=>i.id===this.selectedNeuron.id?!1:!this.brain.connections.some(s=>s.sourceNeuronId===this.selectedNeuron.id&&s.targetNeuronId===i.id));if(e.length===0){alert("No available neurons to connect to.");return}const t=prompt(`Connect to:
${e.map((i,s)=>`${s+1}. ${i.name}`).join(`
`)}

Enter number:`);if(t){const i=parseInt(t)-1;i>=0&&i<e.length&&this.addConnection(e[i].id)}}async addConnection(e){if(!(!this.brain||!this.selectedNeuron))try{const t=await h.addConnection(this.brain.id,{sourceNeuronId:this.selectedNeuron.id,targetNeuronId:e});this.brain.connections.push(t),this.updatePanel(),window.dispatchEvent(new CustomEvent("brain:updated",{detail:this.brain}))}catch(t){console.error("Failed to add connection:",t)}}render(){this.shadowRoot.innerHTML=`
      <style>
        @import '/css/reset.css';
        @import '/css/variables.css';
        @import '/css/components.css';

        :host {
          display: block;
          height: 100%;
          overflow: hidden;
        }

        .panel {
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .panel-header {
          padding: var(--space-4);
          border-bottom: 1px solid var(--color-border);
        }

        .panel-header h3 {
          font-size: var(--text-base);
          font-weight: 600;
        }

        .panel-content {
          flex: 1;
          overflow-y: auto;
          padding: var(--space-4);
        }

        .neuron-form {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .color-picker {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .color-input {
          width: 40px;
          height: 32px;
          padding: 0;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          cursor: pointer;
        }

        .color-value {
          font-family: var(--font-mono);
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
        }

        .connections-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
          margin-bottom: var(--space-2);
        }

        .connection-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-2);
          background-color: var(--color-bg-tertiary);
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
        }

        .no-connections {
          font-size: var(--text-sm);
          color: var(--color-text-muted);
          font-style: italic;
        }

        .form-actions {
          padding-top: var(--space-4);
          border-top: 1px solid var(--color-border);
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          text-align: center;
          color: var(--color-text-muted);
        }

        .empty-state__icon {
          margin-bottom: var(--space-4);
          opacity: 0.5;
        }

        .empty-state__title {
          font-size: var(--text-base);
          font-weight: 500;
          margin-bottom: var(--space-2);
        }

        .empty-state__description {
          font-size: var(--text-sm);
        }
      </style>

      <div class="panel">
        <div class="panel-header">
          <h3>Neuron Properties</h3>
        </div>
        <div class="panel-content">
          ${this.renderEmptyState()}
        </div>
      </div>
    `}}customElements.define("neuron-panel",V);function T(r=0,e=0,t=0){return{x:r,y:e,z:t}}function E(r,e){return{x:r.x+e.x,y:r.y+e.y,z:r.z+e.z}}function v(r,e){return{x:r.x-e.x,y:r.y-e.y,z:r.z-e.z}}function f(r,e){return{x:r.x*e,y:r.y*e,z:r.z*e}}function x(r){const e=Math.sqrt(r.x*r.x+r.y*r.y+r.z*r.z);return e===0?{x:0,y:0,z:0}:{x:r.x/e,y:r.y/e,z:r.z/e}}function L(r,e){return r.x*e.x+r.y*e.y+r.z*e.z}function S(r,e){return{x:r.y*e.z-r.z*e.y,y:r.z*e.x-r.x*e.z,z:r.x*e.y-r.y*e.x}}function O(r,e){const t=new Float32Array(16);for(let i=0;i<4;i++)for(let s=0;s<4;s++){let n=0;for(let a=0;a<4;a++)n+=r[a*4+s]*e[i*4+a];t[i*4+s]=n}return t}function j(r,e,t,i){const s=1/Math.tan(r/2),n=1/(t-i);return new Float32Array([s/e,0,0,0,0,s,0,0,0,0,(i+t)*n,-1,0,0,2*i*t*n,0])}function X(r,e,t){const i=x(v(r,e)),s=x(S(t,i)),n=S(i,s);return new Float32Array([s.x,n.x,i.x,0,s.y,n.y,i.y,0,s.z,n.z,i.z,0,-L(s,r),-L(n,r),-L(i,r),1])}function P(r){const e=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(r);return e?[parseInt(e[1],16)/255,parseInt(e[2],16)/255,parseInt(e[3],16)/255]:[1,1,1]}function A(r,e,t){return Math.max(e,Math.min(t,r))}function G(r){return r*Math.PI/180}class Y{constructor(e){this.canvas=e,this.distance=10,this.phi=Math.PI/4,this.theta=Math.PI/4,this.target=T(0,0,0),this.minDistance=2,this.maxDistance=50,this.minPhi=.1,this.maxPhi=Math.PI-.1,this.fov=G(60),this.near=.1,this.far=100,this.rotateSensitivity=.005,this.panSensitivity=.01,this.zoomSensitivity=.001,this.isDragging=!1,this.isPanning=!1,this.lastMouseX=0,this.lastMouseY=0,this.setupEventListeners()}setupEventListeners(){this.canvas.addEventListener("mousedown",this.onMouseDown.bind(this)),this.canvas.addEventListener("mousemove",this.onMouseMove.bind(this)),this.canvas.addEventListener("mouseup",this.onMouseUp.bind(this)),this.canvas.addEventListener("mouseleave",this.onMouseUp.bind(this)),this.canvas.addEventListener("wheel",this.onWheel.bind(this)),this.canvas.addEventListener("contextmenu",e=>e.preventDefault())}onMouseDown(e){this.lastMouseX=e.clientX,this.lastMouseY=e.clientY,e.button===0?this.isDragging=!0:e.button===2&&(this.isPanning=!0)}onMouseMove(e){if(!this.isDragging&&!this.isPanning)return;const t=e.clientX-this.lastMouseX,i=e.clientY-this.lastMouseY;this.lastMouseX=e.clientX,this.lastMouseY=e.clientY,this.isDragging?this.rotate(t,i):this.isPanning&&this.pan(t,i)}onMouseUp(){this.isDragging=!1,this.isPanning=!1}onWheel(e){e.preventDefault(),this.zoom(e.deltaY)}rotate(e,t){this.theta-=e*this.rotateSensitivity,this.phi+=t*this.rotateSensitivity,this.phi=A(this.phi,this.minPhi,this.maxPhi)}pan(e,t){const i=this.getPosition();x(v(this.target,i));const s=x({x:Math.sin(this.theta-Math.PI/2),y:0,z:Math.cos(this.theta-Math.PI/2)}),n=T(0,1,0),a=this.distance*this.panSensitivity,c=f(s,-e*a),o=f(n,t*a);this.target=E(this.target,E(c,o))}zoom(e){this.distance+=e*this.zoomSensitivity*this.distance,this.distance=A(this.distance,this.minDistance,this.maxDistance)}getPosition(){return{x:this.target.x+this.distance*Math.sin(this.phi)*Math.sin(this.theta),y:this.target.y+this.distance*Math.cos(this.phi),z:this.target.z+this.distance*Math.sin(this.phi)*Math.cos(this.theta)}}getViewMatrix(){return X(this.getPosition(),this.target,T(0,1,0))}getProjectionMatrix(){const e=this.canvas.width/this.canvas.height;return j(this.fov,e,this.near,this.far)}getViewProjectionMatrix(){return O(this.getProjectionMatrix(),this.getViewMatrix())}lookAt(e){this.target={...e}}setDistance(e){this.distance=A(e,this.minDistance,this.maxDistance)}reset(){this.distance=10,this.phi=Math.PI/4,this.theta=Math.PI/4,this.target=T(0,0,0)}animateTo(e,t,i=500){const s={...this.target},n=this.distance,a=performance.now(),c=()=>{const o=performance.now()-a,l=Math.min(o/i,1),u=1-Math.pow(1-l,3);this.target.x=s.x+(e.x-s.x)*u,this.target.y=s.y+(e.y-s.y)*u,this.target.z=s.z+(e.z-s.z)*u,this.distance=n+(t-n)*u,l<1&&requestAnimationFrame(c)};requestAnimationFrame(c)}}function W(r=32,e=16){const t=[],i=[],s=[];for(let n=0;n<=e;n++){const a=n/e*Math.PI,c=Math.sin(a),o=Math.cos(a);for(let l=0;l<=r;l++){const u=l/r*Math.PI*2,g=Math.sin(u),b=Math.cos(u)*c,y=o,w=g*c;t.push(b,y,w),i.push(b,y,w)}}for(let n=0;n<e;n++)for(let a=0;a<r;a++){const c=n*(r+1)+a,o=c+r+1,l=c+1,u=o+1;s.push(c,o,l),s.push(l,o,u)}return{positions:new Float32Array(t),normals:new Float32Array(i),indices:new Uint16Array(s)}}class Q{constructor(e){this.gl=e,this.program=null,this.vao=null,this.indexCount=0,this.init()}init(){const e=this.gl;this.program=this.createProgram();const t=W(24,16);this.indexCount=t.indices.length,this.vao=e.createVertexArray(),e.bindVertexArray(this.vao);const i=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,i),e.bufferData(e.ARRAY_BUFFER,t.positions,e.STATIC_DRAW),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,3,e.FLOAT,!1,0,0);const s=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,s),e.bufferData(e.ARRAY_BUFFER,t.normals,e.STATIC_DRAW),e.enableVertexAttribArray(1),e.vertexAttribPointer(1,3,e.FLOAT,!1,0,0);const n=e.createBuffer();e.bindBuffer(e.ELEMENT_ARRAY_BUFFER,n),e.bufferData(e.ELEMENT_ARRAY_BUFFER,t.indices,e.STATIC_DRAW),e.bindVertexArray(null),this.uniforms={uViewProjection:e.getUniformLocation(this.program,"uViewProjection"),uPosition:e.getUniformLocation(this.program,"uPosition"),uRadius:e.getUniformLocation(this.program,"uRadius"),uColor:e.getUniformLocation(this.program,"uColor"),uEmissive:e.getUniformLocation(this.program,"uEmissive"),uPickingId:e.getUniformLocation(this.program,"uPickingId"),uIsPicking:e.getUniformLocation(this.program,"uIsPicking")}}createProgram(){const e=this.gl,t=e.createShader(e.VERTEX_SHADER);e.shaderSource(t,`#version 300 es
      layout(location = 0) in vec3 aPosition;
      layout(location = 1) in vec3 aNormal;

      uniform mat4 uViewProjection;
      uniform vec3 uPosition;
      uniform float uRadius;

      out vec3 vNormal;
      out vec3 vWorldPos;

      void main() {
        vec3 worldPos = aPosition * uRadius + uPosition;
        vWorldPos = worldPos;
        vNormal = aNormal;
        gl_Position = uViewProjection * vec4(worldPos, 1.0);
      }
    `),e.compileShader(t);const i=e.createShader(e.FRAGMENT_SHADER);e.shaderSource(i,`#version 300 es
      precision highp float;

      in vec3 vNormal;
      in vec3 vWorldPos;

      uniform vec3 uColor;
      uniform float uEmissive;
      uniform int uPickingId;
      uniform bool uIsPicking;

      out vec4 fragColor;

      void main() {
        if (uIsPicking) {
          // Output picking ID as color
          int id = uPickingId;
          fragColor = vec4(
            float((id >> 16) & 0xFF) / 255.0,
            float((id >> 8) & 0xFF) / 255.0,
            float(id & 0xFF) / 255.0,
            1.0
          );
          return;
        }

        // Simple lighting
        vec3 lightDir = normalize(vec3(1.0, 2.0, 1.0));
        vec3 normal = normalize(vNormal);

        float diff = max(dot(normal, lightDir), 0.0);
        float ambient = 0.3;

        vec3 color = uColor * (ambient + diff * 0.7);

        // Add emissive glow
        color = mix(color, uColor, uEmissive);

        fragColor = vec4(color, 1.0);
      }
    `),e.compileShader(i);const s=e.createProgram();return e.attachShader(s,t),e.attachShader(s,i),e.linkProgram(s),e.getProgramParameter(s,e.LINK_STATUS)||console.error("Sphere shader error:",e.getProgramInfoLog(s)),s}render(e,t,i,s,n=0,a=0,c=!1){const o=this.gl;o.useProgram(this.program),o.bindVertexArray(this.vao),o.uniformMatrix4fv(this.uniforms.uViewProjection,!1,e),o.uniform3f(this.uniforms.uPosition,t.x,t.y,t.z),o.uniform1f(this.uniforms.uRadius,i);const l=typeof s=="string"?P(s):s;o.uniform3f(this.uniforms.uColor,l[0],l[1],l[2]),o.uniform1f(this.uniforms.uEmissive,n),o.uniform1i(this.uniforms.uPickingId,a),o.uniform1i(this.uniforms.uIsPicking,c?1:0),o.drawElements(o.TRIANGLES,this.indexCount,o.UNSIGNED_SHORT,0),o.bindVertexArray(null)}renderBatch(e,t,i=!1){const s=this.gl;s.useProgram(this.program),s.bindVertexArray(this.vao),s.uniformMatrix4fv(this.uniforms.uViewProjection,!1,e),s.uniform1i(this.uniforms.uIsPicking,i?1:0);for(const n of t){s.uniform3f(this.uniforms.uPosition,n.position.x,n.position.y,n.position.z),s.uniform1f(this.uniforms.uRadius,n.radius||.5);const a=typeof n.color=="string"?P(n.color):n.color||[.5,.5,.5];s.uniform3f(this.uniforms.uColor,a[0],a[1],a[2]),s.uniform1f(this.uniforms.uEmissive,n.emissive||0),s.uniform1i(this.uniforms.uPickingId,n.id||0),s.drawElements(s.TRIANGLES,this.indexCount,s.UNSIGNED_SHORT,0)}s.bindVertexArray(null)}}class K{constructor(e){this.gl=e,this.program=null,this.maxLines=1e3,this.lineCount=0,this.init()}init(){const e=this.gl;this.program=this.createProgram(),this.vao=e.createVertexArray(),e.bindVertexArray(this.vao),this.positionBuffer=e.createBuffer(),e.bindBuffer(e.ARRAY_BUFFER,this.positionBuffer),e.bufferData(e.ARRAY_BUFFER,this.maxLines*6*4,e.DYNAMIC_DRAW),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,3,e.FLOAT,!1,0,0),this.colorBuffer=e.createBuffer(),e.bindBuffer(e.ARRAY_BUFFER,this.colorBuffer),e.bufferData(e.ARRAY_BUFFER,this.maxLines*6*4,e.DYNAMIC_DRAW),e.enableVertexAttribArray(1),e.vertexAttribPointer(1,3,e.FLOAT,!1,0,0),e.bindVertexArray(null),this.uniforms={uViewProjection:e.getUniformLocation(this.program,"uViewProjection")}}createProgram(){const e=this.gl,t=e.createShader(e.VERTEX_SHADER);e.shaderSource(t,`#version 300 es
      layout(location = 0) in vec3 aPosition;
      layout(location = 1) in vec3 aColor;

      uniform mat4 uViewProjection;

      out vec3 vColor;

      void main() {
        vColor = aColor;
        gl_Position = uViewProjection * vec4(aPosition, 1.0);
      }
    `),e.compileShader(t);const i=e.createShader(e.FRAGMENT_SHADER);e.shaderSource(i,`#version 300 es
      precision highp float;

      in vec3 vColor;
      out vec4 fragColor;

      void main() {
        fragColor = vec4(vColor, 0.7);
      }
    `),e.compileShader(i);const s=e.createProgram();return e.attachShader(s,t),e.attachShader(s,i),e.linkProgram(s),e.getProgramParameter(s,e.LINK_STATUS)||console.error("Line shader error:",e.getProgramInfoLog(s)),s}render(e,t){if(t.length===0)return;const i=this.gl,s=Math.min(t.length,this.maxLines),n=new Float32Array(s*6),a=new Float32Array(s*6);for(let c=0;c<s;c++){const o=t[c],l=c*6;n[l]=o.start.x,n[l+1]=o.start.y,n[l+2]=o.start.z,n[l+3]=o.end.x,n[l+4]=o.end.y,n[l+5]=o.end.z;const u=typeof o.color=="string"?P(o.color):o.color||[.5,.5,.5];a[l]=u[0],a[l+1]=u[1],a[l+2]=u[2],a[l+3]=u[0],a[l+4]=u[1],a[l+5]=u[2]}i.bindBuffer(i.ARRAY_BUFFER,this.positionBuffer),i.bufferSubData(i.ARRAY_BUFFER,0,n),i.bindBuffer(i.ARRAY_BUFFER,this.colorBuffer),i.bufferSubData(i.ARRAY_BUFFER,0,a),i.useProgram(this.program),i.bindVertexArray(this.vao),i.uniformMatrix4fv(this.uniforms.uViewProjection,!1,e),i.enable(i.BLEND),i.blendFunc(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA),i.drawArrays(i.LINES,0,s*2),i.disable(i.BLEND),i.bindVertexArray(null)}renderArrow(e,t,i,s){const n=[];n.push({start:t,end:i,color:s});const a=x(v(i,t)),c=.3,o=.15,l=Math.abs(a.y)<.9?{x:0,y:1,z:0}:{x:1,y:0,z:0},u=x(S(a,l)),g=S(a,u),m=v(i,f(a,c)),b=E(m,f(u,o)),y=v(m,f(u,o)),w=E(m,f(g,o)),M=v(m,f(g,o));n.push({start:i,end:b,color:s}),n.push({start:i,end:y,color:s}),n.push({start:i,end:w,color:s}),n.push({start:i,end:M,color:s}),this.render(e,n)}renderArrows(e,t){const i=[];for(const s of t){const{start:n,end:a,color:c}=s;i.push({start:n,end:a,color:c});const o=x(v(a,n)),l=.2,u=.1,g=Math.abs(o.y)<.9?{x:0,y:1,z:0}:{x:1,y:0,z:0},m=x(S(o,g)),b=v(a,f(o,l)),y=E(b,f(m,u)),w=v(b,f(m,u));i.push({start:a,end:y,color:c}),i.push({start:a,end:w,color:c})}this.render(e,i)}}class J{constructor(e){this.gl=e,this.program=null,this.textureCache=new Map,this.canvas=document.createElement("canvas"),this.ctx=this.canvas.getContext("2d"),this.init()}init(){const e=this.gl;this.program=this.createProgram(),this.vao=e.createVertexArray(),e.bindVertexArray(this.vao);const t=new Float32Array([-.5,-.5,0,0,1,.5,-.5,0,1,1,-.5,.5,0,0,0,.5,.5,0,1,0]),i=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,i),e.bufferData(e.ARRAY_BUFFER,t,e.STATIC_DRAW),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,3,e.FLOAT,!1,20,0),e.enableVertexAttribArray(1),e.vertexAttribPointer(1,2,e.FLOAT,!1,20,12),e.bindVertexArray(null),this.uniforms={uViewProjection:e.getUniformLocation(this.program,"uViewProjection"),uPosition:e.getUniformLocation(this.program,"uPosition"),uScale:e.getUniformLocation(this.program,"uScale"),uTexture:e.getUniformLocation(this.program,"uTexture"),uBillboard:e.getUniformLocation(this.program,"uBillboard")}}createProgram(){const e=this.gl,t=e.createShader(e.VERTEX_SHADER);e.shaderSource(t,`#version 300 es
      layout(location = 0) in vec3 aPosition;
      layout(location = 1) in vec2 aTexCoord;

      uniform mat4 uViewProjection;
      uniform vec3 uPosition;
      uniform vec2 uScale;
      uniform bool uBillboard;

      out vec2 vTexCoord;

      void main() {
        vTexCoord = aTexCoord;

        if (uBillboard) {
          // Billboard - always face camera
          vec4 pos = uViewProjection * vec4(uPosition, 1.0);
          vec2 offset = aPosition.xy * uScale;
          gl_Position = pos + vec4(offset * pos.w, 0.0, 0.0);
        } else {
          vec3 worldPos = aPosition * vec3(uScale, 1.0) + uPosition;
          gl_Position = uViewProjection * vec4(worldPos, 1.0);
        }
      }
    `),e.compileShader(t);const i=e.createShader(e.FRAGMENT_SHADER);e.shaderSource(i,`#version 300 es
      precision highp float;

      in vec2 vTexCoord;

      uniform sampler2D uTexture;

      out vec4 fragColor;

      void main() {
        vec4 color = texture(uTexture, vTexCoord);
        if (color.a < 0.1) discard;
        fragColor = color;
      }
    `),e.compileShader(i);const s=e.createProgram();return e.attachShader(s,t),e.attachShader(s,i),e.linkProgram(s),e.getProgramParameter(s,e.LINK_STATUS)||console.error("Text shader error:",e.getProgramInfoLog(s)),s}getTextTexture(e,t={}){const{font:i="24px sans-serif",color:s="#ffffff",backgroundColor:n="transparent",padding:a=8}=t,c=`${e}|${i}|${s}|${n}`;if(this.textureCache.has(c))return this.textureCache.get(c);const o=this.gl,l=this.ctx;l.font=i;const u=l.measureText(e),g=Math.ceil(u.width+a*2),m=Math.ceil(32+a*2);this.canvas.width=g,this.canvas.height=m,n!=="transparent"?(l.fillStyle=n,l.fillRect(0,0,g,m)):l.clearRect(0,0,g,m),l.font=i,l.fillStyle=s,l.textAlign="center",l.textBaseline="middle",l.fillText(e,g/2,m/2);const b=o.createTexture();o.bindTexture(o.TEXTURE_2D,b),o.texImage2D(o.TEXTURE_2D,0,o.RGBA,o.RGBA,o.UNSIGNED_BYTE,this.canvas),o.texParameteri(o.TEXTURE_2D,o.TEXTURE_MIN_FILTER,o.LINEAR),o.texParameteri(o.TEXTURE_2D,o.TEXTURE_MAG_FILTER,o.LINEAR),o.texParameteri(o.TEXTURE_2D,o.TEXTURE_WRAP_S,o.CLAMP_TO_EDGE),o.texParameteri(o.TEXTURE_2D,o.TEXTURE_WRAP_T,o.CLAMP_TO_EDGE);const y={texture:b,width:g,height:m,aspectRatio:g/m};return this.textureCache.set(c,y),y}render(e,t,i,s={}){const{scale:n=.5,billboard:a=!0,offset:c={x:0,y:.8,z:0}}=s,o=this.gl,l=this.getTextTexture(t,s);o.useProgram(this.program),o.bindVertexArray(this.vao),o.enable(o.BLEND),o.blendFunc(o.SRC_ALPHA,o.ONE_MINUS_SRC_ALPHA),o.uniformMatrix4fv(this.uniforms.uViewProjection,!1,e),o.uniform3f(this.uniforms.uPosition,i.x+c.x,i.y+c.y,i.z+c.z),o.uniform2f(this.uniforms.uScale,n*l.aspectRatio,n),o.uniform1i(this.uniforms.uBillboard,a?1:0),o.activeTexture(o.TEXTURE0),o.bindTexture(o.TEXTURE_2D,l.texture),o.uniform1i(this.uniforms.uTexture,0),o.drawArrays(o.TRIANGLE_STRIP,0,4),o.disable(o.BLEND),o.bindVertexArray(null)}renderBatch(e,t){const i=this.gl;i.useProgram(this.program),i.bindVertexArray(this.vao),i.enable(i.BLEND),i.blendFunc(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA),i.uniformMatrix4fv(this.uniforms.uViewProjection,!1,e),i.activeTexture(i.TEXTURE0),i.uniform1i(this.uniforms.uTexture,0);for(const s of t){const n=this.getTextTexture(s.text,s),a=s.scale||.5,c=s.offset||{x:0,y:.8,z:0};i.uniform3f(this.uniforms.uPosition,s.position.x+c.x,s.position.y+c.y,s.position.z+c.z),i.uniform2f(this.uniforms.uScale,a*n.aspectRatio,a),i.uniform1i(this.uniforms.uBillboard,s.billboard!==!1?1:0),i.bindTexture(i.TEXTURE_2D,n.texture),i.drawArrays(i.TRIANGLE_STRIP,0,4)}i.disable(i.BLEND),i.bindVertexArray(null)}clearCache(){const e=this.gl;for(const t of this.textureCache.values())e.deleteTexture(t.texture);this.textureCache.clear()}}class Z{constructor(e,t,i){this.gl=e,this.width=t,this.height=i,this.framebuffer=null,this.texture=null,this.depthBuffer=null,this.init()}init(){const e=this.gl;this.framebuffer=e.createFramebuffer(),e.bindFramebuffer(e.FRAMEBUFFER,this.framebuffer),this.texture=e.createTexture(),e.bindTexture(e.TEXTURE_2D,this.texture),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,this.width,this.height,0,e.RGBA,e.UNSIGNED_BYTE,null),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,this.texture,0),this.depthBuffer=e.createRenderbuffer(),e.bindRenderbuffer(e.RENDERBUFFER,this.depthBuffer),e.renderbufferStorage(e.RENDERBUFFER,e.DEPTH_COMPONENT16,this.width,this.height),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.DEPTH_ATTACHMENT,e.RENDERBUFFER,this.depthBuffer),e.bindFramebuffer(e.FRAMEBUFFER,null)}resize(e,t){if(this.width===e&&this.height===t)return;this.width=e,this.height=t;const i=this.gl;i.bindTexture(i.TEXTURE_2D,this.texture),i.texImage2D(i.TEXTURE_2D,0,i.RGBA,e,t,0,i.RGBA,i.UNSIGNED_BYTE,null),i.bindRenderbuffer(i.RENDERBUFFER,this.depthBuffer),i.renderbufferStorage(i.RENDERBUFFER,i.DEPTH_COMPONENT16,e,t)}begin(){const e=this.gl;e.bindFramebuffer(e.FRAMEBUFFER,this.framebuffer),e.viewport(0,0,this.width,this.height),e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT|e.DEPTH_BUFFER_BIT)}end(){const e=this.gl;e.bindFramebuffer(e.FRAMEBUFFER,null)}pick(e,t){const i=this.gl;i.bindFramebuffer(i.FRAMEBUFFER,this.framebuffer);const s=new Uint8Array(4);i.readPixels(e,this.height-t,1,1,i.RGBA,i.UNSIGNED_BYTE,s),i.bindFramebuffer(i.FRAMEBUFFER,null);const n=s[0]<<16|s[1]<<8|s[2];return n>0?n:null}destroy(){const e=this.gl;e.deleteFramebuffer(this.framebuffer),e.deleteTexture(this.texture),e.deleteRenderbuffer(this.depthBuffer)}}class C{constructor(e){if(this.canvas=e,this.gl=e.getContext("webgl2",{antialias:!0,alpha:!1}),!this.gl)throw new Error("WebGL2 not supported");this.camera=new Y(e),this.sphereRenderer=null,this.lineRenderer=null,this.textRenderer=null,this.picking=null,this.neurons=[],this.connections=[],this.selectedNeuronId=null,this.hoveredNeuronId=null,this.neuronIdMap=new Map,this.animationFrame=null,this.onNeuronSelect=null,this.onNeuronHover=null,this.init()}init(){const e=this.gl;e.enable(e.DEPTH_TEST),e.depthFunc(e.LEQUAL),e.clearColor(.04,.04,.06,1),this.sphereRenderer=new Q(e),this.lineRenderer=new K(e),this.textRenderer=new J(e),this.picking=new Z(e,this.canvas.width,this.canvas.height),this.canvas.addEventListener("click",this.onClick.bind(this)),this.canvas.addEventListener("mousemove",this.onMouseMove.bind(this)),this.resize(),window.addEventListener("resize",()=>this.resize())}resize(){const e=this.canvas.getBoundingClientRect(),t=window.devicePixelRatio||1;this.canvas.width=e.width*t,this.canvas.height=e.height*t,this.gl.viewport(0,0,this.canvas.width,this.canvas.height),this.picking.resize(this.canvas.width,this.canvas.height)}setNeurons(e){this.neurons=e,this.neuronIdMap.clear(),e.forEach((t,i)=>{this.neuronIdMap.set(i+1,t.id)})}setConnections(e){this.connections=e}setSelectedNeuron(e){this.selectedNeuronId=e}setNeuronStatus(e,t){const i=this.neurons.find(s=>s.id===e);i&&(i.status=t)}getPickingId(e){for(const[t,i]of this.neuronIdMap)if(i===e)return t;return 0}onClick(e){const t=this.canvas.getBoundingClientRect(),i=(e.clientX-t.left)*(this.canvas.width/t.width),s=(e.clientY-t.top)*(this.canvas.height/t.height);this.renderPicking();const n=this.picking.pick(i,s),a=n?this.neuronIdMap.get(n):null;this.onNeuronSelect&&this.onNeuronSelect(a)}onMouseMove(e){const t=this.canvas.getBoundingClientRect(),i=(e.clientX-t.left)*(this.canvas.width/t.width),s=(e.clientY-t.top)*(this.canvas.height/t.height);this.renderPicking();const n=this.picking.pick(i,s),a=n?this.neuronIdMap.get(n):null;a!==this.hoveredNeuronId&&(this.hoveredNeuronId=a,this.canvas.style.cursor=a?"pointer":"default",this.onNeuronHover&&this.onNeuronHover(a))}renderPicking(){const e=this.camera.getViewProjectionMatrix();this.picking.begin();const t=this.neurons.map((i,s)=>({id:s+1,position:i.position,radius:.5,color:[1,1,1]}));this.sphereRenderer.renderBatch(e,t,!0),this.picking.end()}render(){const e=this.gl,t=this.camera.getViewProjectionMatrix();e.clear(e.COLOR_BUFFER_BIT|e.DEPTH_BUFFER_BIT),this.renderConnections(t),this.renderNeurons(t),this.renderLabels(t)}renderNeurons(e){const t=this.neurons.map(i=>{let s=0;return i.id===this.selectedNeuronId&&(s=.3),i.status==="processing"?s=.5+Math.sin(Date.now()*.01)*.2:i.status==="fired"&&(s=.4),{id:this.getPickingId(i.id),position:i.position,radius:.5,color:i.color||"#6366f1",emissive:s}});this.sphereRenderer.renderBatch(e,t,!1)}renderConnections(e){const t=this.connections.map(i=>{const s=this.neurons.find(l=>l.id===i.sourceNeuronId),n=this.neurons.find(l=>l.id===i.targetNeuronId);if(!s||!n)return null;const a=x(v(n.position,s.position)),c=E(s.position,f(a,.55)),o=v(n.position,f(a,.55));return{start:c,end:o,color:"#4b5563"}}).filter(Boolean);this.lineRenderer.renderArrows(e,t)}renderLabels(e){const t=this.neurons.map(i=>({text:i.name,position:i.position,color:"#ffffff",scale:.4,offset:{x:0,y:.9,z:0}}));this.textRenderer.renderBatch(e,t)}start(){const e=()=>{this.render(),this.animationFrame=requestAnimationFrame(e)};e()}stop(){this.animationFrame&&(cancelAnimationFrame(this.animationFrame),this.animationFrame=null)}focusNeuron(e){const t=this.neurons.find(i=>i.id===e);t&&this.camera.animateTo(t.position,5)}resetCamera(){this.camera.reset()}destroy(){this.stop(),this.picking.destroy(),this.textRenderer.clearCache()}}class ee extends HTMLElement{constructor(){super(),this.attachShadow({mode:"open"}),this.renderer=null,this.brain=null}connectedCallback(){this.render(),this.initRenderer(),window.addEventListener("brain:updated",e=>{e.detail&&(this.brain=e.detail,this.updateRenderer())}),window.addEventListener("neuron:updated",e=>{if(this.brain&&e.detail){const t=this.brain.neurons.findIndex(i=>i.id===e.detail.id);t>=0&&(this.brain.neurons[t]=e.detail,this.updateRenderer())}}),p.subscribe(e=>{this.renderer&&this.renderer.setSelectedNeuron(e.selectedNeuronId)})}disconnectedCallback(){this.renderer&&this.renderer.destroy()}initRenderer(){const e=this.shadowRoot.querySelector("canvas");e&&(this.renderer=new C(e),this.renderer.onNeuronSelect=t=>{B(t)},this.renderer.onNeuronHover=t=>{},this.renderer.start())}setBrain(e){this.brain=e,this.updateRenderer()}updateRenderer(){!this.renderer||!this.brain||(this.renderer.setNeurons(this.brain.neurons),this.renderer.setConnections(this.brain.connections))}resetCamera(){this.renderer&&this.renderer.resetCamera()}focusNeuron(e){this.renderer&&this.renderer.focusNeuron(e)}render(){this.shadowRoot.innerHTML=`
      <style>
        :host {
          display: block;
          width: 100%;
          height: 100%;
        }

        canvas {
          width: 100%;
          height: 100%;
          display: block;
        }
      </style>
      <canvas></canvas>
    `}}customElements.define("webgl-canvas",ee);class _{constructor(e,t){this.execId=e,this.token=t,this.ws=null,this.reconnectAttempts=0,this.maxReconnectAttempts=5,this.reconnectDelay=1e3,this.listeners={open:[],close:[],error:[],message:[],execution_started:[],step_started:[],neuron_processing:[],neuron_output:[],neuron_error:[],step_completed:[],execution_paused:[],execution_resumed:[],execution_fizzled:[],final_output:[]}}connect(){const t=`${window.location.protocol==="https:"?"wss:":"ws:"}//${window.location.host}/api/executions/${this.execId}/stream`;this.ws=new WebSocket(t),this.ws.onopen=()=>{this.reconnectAttempts=0,this.emit("open")},this.ws.onclose=i=>{if(this.emit("close",i),this.reconnectAttempts<this.maxReconnectAttempts){this.reconnectAttempts++;const s=this.reconnectDelay*Math.pow(2,this.reconnectAttempts-1);setTimeout(()=>this.connect(),s)}},this.ws.onerror=i=>{this.emit("error",i)},this.ws.onmessage=i=>{try{const s=JSON.parse(i.data);this.emit("message",s),s.type&&this.listeners[s.type]&&this.emit(s.type,s.data)}catch(s){console.error("WebSocket message parse error:",s)}}}disconnect(){this.maxReconnectAttempts=0,this.ws&&(this.ws.close(),this.ws=null)}send(e,t={}){this.ws&&this.ws.readyState===WebSocket.OPEN&&this.ws.send(JSON.stringify({type:e,data:t}))}pause(){this.send("pause")}resume(){this.send("resume")}step(){this.send("step")}sendInput(e,t="text"){this.send("input",{content:e,type:t})}on(e,t){return this.listeners[e]&&this.listeners[e].push(t),this}off(e,t){return this.listeners[e]&&(this.listeners[e]=this.listeners[e].filter(i=>i!==t)),this}emit(e,t){if(this.listeners[e])for(const i of this.listeners[e])i(t)}isConnected(){return this.ws&&this.ws.readyState===WebSocket.OPEN}}class te extends HTMLElement{static get observedAttributes(){return["brain-id"]}constructor(){super(),this.attachShadow({mode:"open"}),this.brain=null,this.messages=[],this.execution=null,this.ws=null,this.isLoading=!1}connectedCallback(){this.render(),this.loadBrain()}disconnectedCallback(){this.ws&&this.ws.disconnect()}attributeChangedCallback(e,t,i){e==="brain-id"&&t!==i&&this.loadBrain()}async loadBrain(){const e=this.getAttribute("brain-id");if(e)try{this.brain=await h.getBrain(e),this.updateHeader()}catch(t){console.error("Failed to load brain:",t)}}updateHeader(){const e=this.shadowRoot.querySelector(".chat-header h2");e&&this.brain&&(e.textContent=`Chat with ${this.brain.name}`)}async sendMessage(){const e=this.shadowRoot.querySelector(".message-input"),t=e.value.trim();if(!(!t||this.isLoading||!this.brain)){this.addMessage("user",t),e.value="",this.isLoading=!0,this.updateInputState();try{this.execution=await h.startExecution(this.brain.id,{initialInput:t}),this.ws=new _(this.execution.id,h.getToken());let i="";const s=this.addMessage("assistant","",!0);this.ws.on("final_output",n=>{i=n.content,this.updateMessage(s,i)}),this.ws.on("execution_fizzled",()=>{this.isLoading=!1,this.updateInputState(),this.updateMessage(s,i,!1),this.ws.disconnect()}),this.ws.on("error",n=>{console.error("WebSocket error:",n),this.isLoading=!1,this.updateInputState(),this.ws.disconnect()}),this.ws.connect()}catch(i){console.error("Failed to send message:",i),this.isLoading=!1,this.updateInputState(),this.addMessage("assistant","Sorry, there was an error processing your message.")}}}addMessage(e,t,i=!1){const s=Date.now().toString(),n={id:s,role:e,content:t,isStreaming:i};return this.messages.push(n),this.renderMessages(),s}updateMessage(e,t,i=!0){const s=this.messages.find(n=>n.id===e);s&&(s.content=t,s.isStreaming=i,this.renderMessages())}renderMessages(){const e=this.shadowRoot.querySelector(".messages");e&&(e.innerHTML=this.messages.map(t=>`
      <div class="message message--${t.role}">
        <div class="message__content">
          ${this.escapeHtml(t.content)}
          ${t.isStreaming?'<span class="typing-indicator">...</span>':""}
        </div>
      </div>
    `).join(""),e.scrollTop=e.scrollHeight)}updateInputState(){const e=this.shadowRoot.querySelector(".message-input"),t=this.shadowRoot.querySelector(".send-btn");e&&(e.disabled=this.isLoading),t&&(t.disabled=this.isLoading,t.innerHTML=this.isLoading?'<span class="spinner"></span>':this.getSendIcon())}getSendIcon(){return`
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="22" y1="2" x2="11" y2="13"/>
        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
      </svg>
    `}escapeHtml(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}render(){this.shadowRoot.innerHTML=`
      <style>
        @import '/css/reset.css';
        @import '/css/variables.css';
        @import '/css/layout.css';
        @import '/css/components.css';

        :host {
          display: block;
          height: 100%;
        }

        .chat-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          background-color: var(--color-bg-primary);
        }

        .chat-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-4) var(--space-6);
          background-color: var(--color-bg-secondary);
          border-bottom: 1px solid var(--color-border);
        }

        .chat-header h2 {
          font-size: var(--text-lg);
          font-weight: 600;
        }

        .chat-header__actions {
          display: flex;
          gap: var(--space-2);
        }

        .messages {
          flex: 1;
          overflow-y: auto;
          padding: var(--space-6);
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .message {
          max-width: 80%;
        }

        .message--user {
          align-self: flex-end;
        }

        .message--assistant {
          align-self: flex-start;
        }

        .message__content {
          padding: var(--space-3) var(--space-4);
          border-radius: var(--radius-lg);
          font-size: var(--text-sm);
          line-height: 1.6;
          white-space: pre-wrap;
        }

        .message--user .message__content {
          background-color: var(--color-primary);
          color: white;
          border-bottom-right-radius: var(--radius-sm);
        }

        .message--assistant .message__content {
          background-color: var(--color-bg-tertiary);
          border-bottom-left-radius: var(--radius-sm);
        }

        .typing-indicator {
          animation: blink 1s infinite;
        }

        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }

        .chat-input {
          padding: var(--space-4) var(--space-6);
          background-color: var(--color-bg-secondary);
          border-top: 1px solid var(--color-border);
        }

        .input-container {
          display: flex;
          gap: var(--space-3);
          align-items: flex-end;
        }

        .message-input {
          flex: 1;
          padding: var(--space-3) var(--space-4);
          font-size: var(--text-sm);
          border-radius: var(--radius-lg);
          resize: none;
          min-height: 44px;
          max-height: 200px;
        }

        .send-btn {
          width: 44px;
          height: 44px;
          border-radius: var(--radius-lg);
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: var(--color-primary);
          color: white;
          transition: background-color var(--transition-fast);
        }

        .send-btn:hover:not(:disabled) {
          background-color: var(--color-primary-hover);
        }

        .send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .spinner {
          width: 20px;
          height: 20px;
          border-width: 2px;
        }

        .empty-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: var(--color-text-muted);
        }

        .empty-state__icon {
          margin-bottom: var(--space-4);
          opacity: 0.5;
        }
      </style>

      <div class="chat-container">
        <header class="chat-header">
          <h2>Chat with Brain</h2>
          <div class="chat-header__actions">
            <button class="btn btn--secondary" id="edit-btn">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Edit
            </button>
            <button class="btn btn--secondary" id="live-btn">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              Live View
            </button>
          </div>
        </header>

        <div class="messages">
          <div class="empty-state">
            <svg class="empty-state__icon" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <p>Send a message to start chatting with this brain</p>
          </div>
        </div>

        <div class="chat-input">
          <div class="input-container">
            <textarea
              class="input message-input"
              placeholder="Type your message..."
              rows="1"
            ></textarea>
            <button class="send-btn" type="button">
              ${this.getSendIcon()}
            </button>
          </div>
        </div>
      </div>
    `;const e=this.shadowRoot.querySelector(".send-btn"),t=this.shadowRoot.querySelector(".message-input");e.addEventListener("click",()=>this.sendMessage()),t.addEventListener("keydown",i=>{i.key==="Enter"&&!i.shiftKey&&(i.preventDefault(),this.sendMessage())}),t.addEventListener("input",()=>{t.style.height="auto",t.style.height=Math.min(t.scrollHeight,200)+"px"}),this.shadowRoot.getElementById("edit-btn").addEventListener("click",()=>{this.brain&&d.navigate(`/brains/${this.brain.id}/edit`)}),this.shadowRoot.getElementById("live-btn").addEventListener("click",()=>{this.brain&&d.navigate(`/brains/${this.brain.id}/live`)})}}customElements.define("chat-view",te);class ie extends HTMLElement{static get observedAttributes(){return["brain-id","exec-id"]}constructor(){super(),this.attachShadow({mode:"open"}),this.brain=null,this.execution=null,this.ws=null,this.renderer=null,this.selectedNeuronId=null,this.neuronStates=new Map}connectedCallback(){this.render(),this.loadBrain()}disconnectedCallback(){this.ws&&this.ws.disconnect(),this.renderer&&this.renderer.destroy()}attributeChangedCallback(e,t,i){t!==i&&(e==="brain-id"?this.loadBrain():e==="exec-id"&&i&&this.loadExecution(i))}async loadBrain(){const e=this.getAttribute("brain-id");if(e)try{this.brain=await h.getBrain(e),this.updateHeader(),this.initRenderer();const t=this.getAttribute("exec-id");t&&this.loadExecution(t)}catch(t){console.error("Failed to load brain:",t)}}async loadExecution(e){try{this.execution=await h.getExecution(e),this.connectWebSocket(),this.updateNeuronStates(),this.updateControls()}catch(t){console.error("Failed to load execution:",t)}}initRenderer(){const e=this.shadowRoot.querySelector("canvas");!e||!this.brain||(this.renderer=new C(e),this.renderer.setNeurons(this.brain.neurons),this.renderer.setConnections(this.brain.connections),this.renderer.onNeuronSelect=t=>{this.selectedNeuronId=t,this.updateInspector()},this.renderer.start())}connectWebSocket(){this.execution&&(this.ws&&this.ws.disconnect(),this.ws=new _(this.execution.id,h.getToken()),this.ws.on("step_started",e=>{this.updateStepCounter(e.step)}),this.ws.on("neuron_processing",e=>{this.setNeuronStatus(e.neuronId,"processing")}),this.ws.on("neuron_output",e=>{this.setNeuronStatus(e.neuronId,"fired"),this.updateNeuronState(e.neuronId,{lastOutput:e.output,lastSelfUpdate:e.selfUpdate})}),this.ws.on("neuron_error",e=>{this.setNeuronStatus(e.neuronId,"error")}),this.ws.on("step_completed",e=>{setTimeout(()=>{this.neuronStates.forEach((t,i)=>{t.status==="fired"&&this.setNeuronStatus(i,"idle")})},500)}),this.ws.on("execution_paused",()=>{this.execution.status="paused",this.updateControls()}),this.ws.on("execution_resumed",()=>{this.execution.status="running",this.updateControls()}),this.ws.on("execution_fizzled",e=>{this.execution.status="paused",this.updateControls(),this.showMessage(`Brain fizzled after ${e.totalSteps} steps`)}),this.ws.on("final_output",e=>{this.showOutput(e.content)}),this.ws.connect())}setNeuronStatus(e,t){let i=this.neuronStates.get(e);i||(i={neuronId:e,status:t,memory:[],inputQueue:[]},this.neuronStates.set(e,i)),i.status=t,this.renderer&&this.renderer.setNeuronStatus(e,t),this.selectedNeuronId===e&&this.updateInspector()}updateNeuronState(e,t){let i=this.neuronStates.get(e);i||(i={neuronId:e,status:"idle",memory:[],inputQueue:[]},this.neuronStates.set(e,i)),Object.assign(i,t),this.selectedNeuronId===e&&this.updateInspector()}updateNeuronStates(){if(this.execution)for(const[e,t]of Object.entries(this.execution.neuronStates||{}))this.neuronStates.set(e,t),this.renderer&&this.renderer.setNeuronStatus(e,t.status)}updateHeader(){const e=this.shadowRoot.querySelector(".live-header h2");e&&this.brain&&(e.textContent=`Live View: ${this.brain.name}`)}updateStepCounter(e){const t=this.shadowRoot.querySelector(".step-counter");t&&(t.textContent=`Step: ${e}`)}updateControls(){const e=this.shadowRoot.querySelector("#pause-btn"),t=this.shadowRoot.querySelector("#step-btn");if(!this.execution){e&&(e.style.display="none"),t&&(t.style.display="none");return}const i=this.execution.status==="paused";e&&(e.innerHTML=i?'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Resume':'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause'),t&&(t.disabled=!i)}updateInspector(){var t;const e=this.shadowRoot.querySelector("neuron-inspector");if(e){const i=(t=this.brain)==null?void 0:t.neurons.find(n=>n.id===this.selectedNeuronId),s=this.neuronStates.get(this.selectedNeuronId);e.setNeuron(i,s)}}showMessage(e){const t=this.shadowRoot.querySelector(".output-display");t&&(t.textContent=e)}showOutput(e){const t=this.shadowRoot.querySelector(".output-display");t&&(t.textContent=e)}async startExecution(){if(!this.brain)return;const e=prompt("Enter initial input for the brain:");if(e!==null)try{this.execution=await h.startExecution(this.brain.id,{initialInput:e}),this.connectWebSocket(),this.updateControls(),d.navigate(`/brains/${this.brain.id}/live/${this.execution.id}`)}catch(t){console.error("Failed to start execution:",t)}}async togglePause(){if(this.execution)try{this.execution.status==="paused"?(await h.resumeExecution(this.execution.id),this.execution.status="running"):(await h.pauseExecution(this.execution.id),this.execution.status="paused"),this.updateControls()}catch(e){console.error("Failed to toggle pause:",e)}}async manualStep(){if(!(!this.execution||this.execution.status!=="paused"))try{await h.stepExecution(this.execution.id)}catch(e){console.error("Failed to step:",e)}}async sendInput(){if(!this.execution)return;const e=prompt("Enter input to send:");if(e!==null)try{await h.sendInput(this.execution.id,e)}catch(t){console.error("Failed to send input:",t)}}render(){this.shadowRoot.innerHTML=`
      <style>
        @import '/css/reset.css';
        @import '/css/variables.css';
        @import '/css/layout.css';
        @import '/css/components.css';

        :host {
          display: block;
          height: 100%;
        }

        .live-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          background-color: var(--color-bg-primary);
        }

        .live-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-4) var(--space-6);
          background-color: var(--color-bg-secondary);
          border-bottom: 1px solid var(--color-border);
        }

        .live-header h2 {
          font-size: var(--text-lg);
          font-weight: 600;
        }

        .live-header__controls {
          display: flex;
          align-items: center;
          gap: var(--space-4);
        }

        .step-counter {
          font-family: var(--font-mono);
          font-size: var(--text-sm);
          color: var(--color-text-secondary);
          padding: var(--space-2) var(--space-3);
          background-color: var(--color-bg-tertiary);
          border-radius: var(--radius-md);
        }

        .live-content {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        .canvas-container {
          flex: 1;
          position: relative;
        }

        canvas {
          width: 100%;
          height: 100%;
          display: block;
        }

        .output-panel {
          position: absolute;
          bottom: var(--space-4);
          left: var(--space-4);
          right: var(--space-4);
          max-height: 150px;
          background-color: var(--color-bg-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }

        .output-header {
          padding: var(--space-2) var(--space-3);
          font-size: var(--text-xs);
          font-weight: 500;
          color: var(--color-text-secondary);
          background-color: var(--color-bg-tertiary);
          border-bottom: 1px solid var(--color-border);
        }

        .output-display {
          padding: var(--space-3);
          font-size: var(--text-sm);
          max-height: 100px;
          overflow-y: auto;
          white-space: pre-wrap;
        }

        .inspector-panel {
          width: var(--panel-width);
          border-left: 1px solid var(--color-border);
          background-color: var(--color-bg-secondary);
        }
      </style>

      <div class="live-container">
        <header class="live-header">
          <h2>Live View: Loading...</h2>
          <div class="live-header__controls">
            <span class="step-counter">Step: 0</span>
            <button class="btn btn--secondary" id="start-btn">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Start
            </button>
            <button class="btn btn--secondary" id="pause-btn" style="display:none">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="6" y="4" width="4" height="16"/>
                <rect x="14" y="4" width="4" height="16"/>
              </svg>
              Pause
            </button>
            <button class="btn btn--secondary" id="step-btn" disabled>Step</button>
            <button class="btn btn--secondary" id="input-btn">Send Input</button>
            <button class="btn btn--ghost" id="edit-btn">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Edit
            </button>
          </div>
        </header>
        <div class="live-content">
          <div class="canvas-container">
            <canvas></canvas>
            <div class="output-panel">
              <div class="output-header">Output</div>
              <div class="output-display">No output yet...</div>
            </div>
          </div>
          <aside class="inspector-panel">
            <neuron-inspector></neuron-inspector>
          </aside>
        </div>
      </div>
    `,this.shadowRoot.getElementById("start-btn").addEventListener("click",()=>this.startExecution()),this.shadowRoot.getElementById("pause-btn").addEventListener("click",()=>this.togglePause()),this.shadowRoot.getElementById("step-btn").addEventListener("click",()=>this.manualStep()),this.shadowRoot.getElementById("input-btn").addEventListener("click",()=>this.sendInput()),this.shadowRoot.getElementById("edit-btn").addEventListener("click",()=>{this.brain&&d.navigate(`/brains/${this.brain.id}/edit`)})}}customElements.define("live-view",ie);class se extends HTMLElement{constructor(){super(),this.attachShadow({mode:"open"}),this.neuron=null,this.state=null}connectedCallback(){this.render()}setNeuron(e,t){this.neuron=e,this.state=t,this.updateDisplay()}updateDisplay(){const e=this.shadowRoot.querySelector(".inspector-content");if(e){if(!this.neuron){e.innerHTML=this.renderEmptyState();return}e.innerHTML=this.renderNeuronInfo()}}renderEmptyState(){return`
      <div class="empty-state">
        <svg class="empty-state__icon" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        <p class="empty-state__title">No Neuron Selected</p>
        <p class="empty-state__description">Click on a neuron to inspect its state</p>
      </div>
    `}renderNeuronInfo(){const e=this.neuron,t=this.state||{},i={idle:"var(--color-neuron-idle)",queued:"var(--color-neuron-queued)",processing:"var(--color-neuron-processing)",fired:"var(--color-neuron-fired)",error:"var(--color-neuron-error)"};return`
      <div class="neuron-header">
        <div class="neuron-color" style="background-color: ${e.color||"#6366f1"}"></div>
        <div class="neuron-title">
          <h3>${this.escapeHtml(e.name)}</h3>
          <span class="neuron-type badge badge--info">${e.type}</span>
        </div>
      </div>

      <div class="section">
        <h4>Status</h4>
        <div class="status-row">
          <span class="status-dot" style="background-color: ${i[t.status]||i.idle}"></span>
          <span class="status-text">${t.status||"idle"}</span>
        </div>
      </div>

      <div class="section">
        <h4>Metrics</h4>
        <div class="metrics-grid">
          <div class="metric">
            <span class="metric-value">${t.totalFireCount||0}</span>
            <span class="metric-label">Fires</span>
          </div>
          <div class="metric">
            <span class="metric-value">${t.totalTokensUsed||0}</span>
            <span class="metric-label">Tokens</span>
          </div>
          <div class="metric">
            <span class="metric-value">${Math.round(t.averageResponseTimeMs||0)}ms</span>
            <span class="metric-label">Avg Time</span>
          </div>
        </div>
      </div>

      <div class="section">
        <h4>Input Queue (${(t.inputQueue||[]).length})</h4>
        <div class="queue-list">
          ${(t.inputQueue||[]).length===0?'<p class="empty-text">No queued inputs</p>':(t.inputQueue||[]).map(s=>`
              <div class="queue-item">
                <span class="queue-source">${this.escapeHtml(s.sourceNeuronName)}:</span>
                <span class="queue-content">${this.truncate(s.content,100)}</span>
              </div>
            `).join("")}
        </div>
      </div>

      <div class="section">
        <h4>Memory (${(t.memory||[]).length}/${e.memoryLength})</h4>
        <div class="memory-list">
          ${(t.memory||[]).length===0?'<p class="empty-text">No memory entries</p>':(t.memory||[]).slice(-5).reverse().map(s=>`
              <div class="memory-item">
                <span class="memory-step">Step ${s.step}</span>
                <span class="memory-content">${this.truncate(s.selfUpdate,150)}</span>
              </div>
            `).join("")}
        </div>
      </div>

      ${t.lastOutput?`
        <div class="section">
          <h4>Last Output</h4>
          <div class="output-content">${this.escapeHtml(t.lastOutput)}</div>
        </div>
      `:""}

      ${t.lastSelfUpdate?`
        <div class="section">
          <h4>Last Self-Update</h4>
          <div class="output-content">${this.escapeHtml(t.lastSelfUpdate)}</div>
        </div>
      `:""}
    `}escapeHtml(e){const t=document.createElement("div");return t.textContent=e,t.innerHTML}truncate(e,t){return e?e.length<=t?this.escapeHtml(e):this.escapeHtml(e.slice(0,t))+"...":""}render(){this.shadowRoot.innerHTML=`
      <style>
        @import '/css/reset.css';
        @import '/css/variables.css';
        @import '/css/components.css';

        :host {
          display: block;
          height: 100%;
        }

        .inspector {
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .inspector-header {
          padding: var(--space-4);
          border-bottom: 1px solid var(--color-border);
        }

        .inspector-header h3 {
          font-size: var(--text-base);
          font-weight: 600;
        }

        .inspector-content {
          flex: 1;
          overflow-y: auto;
          padding: var(--space-4);
        }

        .neuron-header {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          margin-bottom: var(--space-4);
        }

        .neuron-color {
          width: 24px;
          height: 24px;
          border-radius: var(--radius-md);
          flex-shrink: 0;
        }

        .neuron-title h3 {
          font-size: var(--text-base);
          font-weight: 600;
          margin-bottom: var(--space-1);
        }

        .section {
          margin-bottom: var(--space-4);
        }

        .section h4 {
          font-size: var(--text-sm);
          font-weight: 500;
          color: var(--color-text-secondary);
          margin-bottom: var(--space-2);
        }

        .status-row {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .status-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }

        .status-text {
          font-size: var(--text-sm);
          text-transform: capitalize;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--space-3);
        }

        .metric {
          text-align: center;
          padding: var(--space-2);
          background-color: var(--color-bg-tertiary);
          border-radius: var(--radius-md);
        }

        .metric-value {
          display: block;
          font-size: var(--text-lg);
          font-weight: 600;
          color: var(--color-primary);
        }

        .metric-label {
          display: block;
          font-size: var(--text-xs);
          color: var(--color-text-muted);
          margin-top: var(--space-1);
        }

        .queue-list,
        .memory-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
          max-height: 150px;
          overflow-y: auto;
        }

        .queue-item,
        .memory-item {
          padding: var(--space-2);
          background-color: var(--color-bg-tertiary);
          border-radius: var(--radius-md);
          font-size: var(--text-xs);
        }

        .queue-source,
        .memory-step {
          display: block;
          font-weight: 500;
          color: var(--color-text-secondary);
          margin-bottom: var(--space-1);
        }

        .queue-content,
        .memory-content {
          color: var(--color-text-primary);
          word-break: break-word;
        }

        .output-content {
          padding: var(--space-2);
          background-color: var(--color-bg-tertiary);
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
          max-height: 150px;
          overflow-y: auto;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .empty-text {
          font-size: var(--text-sm);
          color: var(--color-text-muted);
          font-style: italic;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          text-align: center;
          color: var(--color-text-muted);
        }

        .empty-state__icon {
          margin-bottom: var(--space-4);
          opacity: 0.5;
        }

        .empty-state__title {
          font-size: var(--text-base);
          font-weight: 500;
          margin-bottom: var(--space-2);
        }

        .empty-state__description {
          font-size: var(--text-sm);
        }
      </style>

      <div class="inspector">
        <div class="inspector-header">
          <h3>Neuron Inspector</h3>
        </div>
        <div class="inspector-content">
          ${this.renderEmptyState()}
        </div>
      </div>
    `}}customElements.define("neuron-inspector",se);document.addEventListener("DOMContentLoaded",()=>{const r=document.getElementById("app-loading");r&&(r.style.display="none");const e=document.getElementById("app");e&&(e.style.display="block")});window.addEventListener("error",r=>{console.error("Global error:",r.error)});window.addEventListener("unhandledrejection",r=>{console.error("Unhandled promise rejection:",r.reason)});console.log("%cWormsBatsAndFlies","font-size: 24px; font-weight: bold; color: #6366f1;");console.log("%cLLM Orchestration System","font-size: 14px; color: #a0a0b0;");console.log("%cInspired by Neal Stephenson's Anathem","font-size: 12px; color: #606070; font-style: italic;");
