    const SUPABASE_URL = 'https://nkcfnbygggrekgnbbjrx.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_WzkcsriEcH71Ym0QMHt0gA_Utm_oKgu';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hashValido=h=>/^[a-fA-F0-9]{40}$/.test(h||'');
const urlSegura=u=>{try{const x=new URL(u);return /^https?:$/.test(x.protocol)?x.href:''}catch{return ''}};
const IMG_DEF='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400"><rect width="600" height="400" fill="#DDE3EB"/><path d="M230 110h100l60 60v120H230z" fill="none" stroke="#9AA6B6" stroke-width="10"/></svg>');
const imgCard=u=>{const s=urlSegura(u);return /placehold\.co.*text=(PitiTorrent|Drive)$/i.test(s)?'':s};
const LS=(k,v)=>{try{if(v===undefined)return JSON.parse(localStorage.getItem(k));v===null?localStorage.removeItem(k):localStorage.setItem(k,JSON.stringify(v))}catch{return null}};
// Persistencia: chunk store de WebTorrent sobre IndexedDB (sobrevive a F5, cierre y reinicio)
const CH_DB=new Promise((ok,ko)=>{const r=indexedDB.open('pititorrent-chunks',1);r.onupgradeneeded=()=>r.result.createObjectStore('c');r.onsuccess=()=>ok(r.result);r.onerror=()=>ko(r.error)});
const idbOp=(m,fn)=>CH_DB.then(d=>new Promise((ok,ko)=>{const t=d.transaction('c',m);const q=fn(t.objectStore('c'));t.oncomplete=()=>ok(q&&q.result);t.onerror=t.onabort=()=>ko(t.error)}));
class StoreIDB{
  constructor(len,o){this.chunkLength=len;this.name=String(o&&o.name||'x');this.length=o&&o.length}
  put(i,b,cb){idbOp('readwrite',s=>s.put(new Uint8Array(b),this.name+'/'+i)).then(()=>cb(null),cb)}
  get(i,o,cb){if(typeof o==='function'){cb=o;o={}}
    idbOp('readonly',s=>s.get(this.name+'/'+i)).then(d=>{if(!d)return cb(new Error('Chunk not found'));
      const a=(o&&o.offset)||0,e=o&&o.length!=null?a+o.length:d.length,u=d.subarray(a,e);
      u.copy=function(t,ts=0,ss=0,se=this.length){t.set(this.subarray(ss,se),ts);return se-ss};cb(null,u)},cb)}
  close(cb){cb&&cb(null)} destroy(cb){cb&&cb(null)}   // destroy NO borra: se purga solo al eliminar del catálogo
}
const purgar=h=>idbOp('readwrite',s=>s.delete(IDBKeyRange.bound(h+'/',h+'/\uffff'))).catch(()=>{});
const opcionesTorrent=()=>({store:StoreIDB,announce:trackers});
const pend=()=>LS('pititorrent_pendientes')||[];
const marcarPendiente=h=>{const p=pend();if(!p.includes(h))LS('pititorrent_pendientes',[...p,h])};
const quitarPendiente=h=>LS('pititorrent_pendientes',pend().filter(x=>x!==h));
async function insertarTorrent(rows){
  if(!modoAdmin)return{error:{message:'Solo el administrador publica.'}};
  const q=db.from('torrents').insert(rows),r=await q;if(r.error)alert('No se pudo publicar: '+r.error.message);return r}
    const catalogoEl = document.getElementById('catalogo');

    function formatearTamano(bytes) {
      if (!bytes || bytes === 0) return '0 B';
      const k = 1024;
      const tamaños = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + tamaños[i];
    }

    function formatearVelocidad(bytesPorSegundo) {
      if (!bytesPorSegundo || bytesPorSegundo < 1024) {
        return Math.round(bytesPorSegundo || 0) + ' B/s';
      }
      const kbps = bytesPorSegundo / 1024;
      if (kbps < 1024) {
        return kbps.toFixed(1) + ' KB/s';
      }
      return (kbps / 1024).toFixed(2) + ' MB/s';
    }

    // --- MANEJO DE ACCESO AL DISCO LOCAL (File System Access API) ---
    let handleCarpetaLocal = null;

    async function leerDirectorioRecursivo(dirHandle, rutaBase = '') {
      let archivos = [];
      for await (const entry of dirHandle.values()) {
        const rutaActual = rutaBase + entry.name;
        if (entry.kind === 'file') {
          const file = await entry.getFile();
          Object.defineProperty(file, 'webkitRelativePath', { value: rutaActual });
          archivos.push(file);
        } else if (entry.kind === 'directory') {
          const subArchivos = await leerDirectorioRecursivo(entry, rutaActual + '/');
          archivos.push(...subArchivos);
        }
      }
      return archivos;
    }

    document.getElementById('btn-vincular-disco').addEventListener('click', async () => {
      if (typeof window.showDirectoryPicker !== 'function') {
        alert('Tu navegador no soporta el acceso directo al disco local mediante API. Usa los botones de archivo o arrastra y suelta.');
        return;
      }
      try {
        handleCarpetaLocal = await window.showDirectoryPicker();
        await guardarHandleEnIDB(handleCarpetaLocal);
        
        const infoSeleccion = document.getElementById('info-seleccion');
        infoSeleccion.classList.add('cargado');
        infoSeleccion.textContent = `Carpeta vinculada al PC: ${handleCarpetaLocal.name}`;
        document.getElementById('titulo').value = handleCarpetaLocal.name;

        let lista = [];
        for await (const entry of handleCarpetaLocal.values()) {
          if (entry.kind === 'file') {
            const f = await entry.getFile();
            Object.defineProperty(f, 'webkitRelativePath', { value: handleCarpetaLocal.name + '/' + f.name });
            lista.push(f);
          } else if (entry.kind === 'directory') {
            const subs = await leerDirectorioRecursivo(entry, handleCarpetaLocal.name + '/' + entry.name + '/');
            lista = lista.concat(subs);
          }
        }
        archivosSeleccionados = lista;
      } catch (err) {
        console.log('Selección de carpeta cancelada o rechazada:', err);
      }
    });

    const IDB_NAME = 'PitiTorrentServidorDB';
    const IDB_STORE = 'handles_disco';

    function abrirIDB() {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, 2);
        req.onupgradeneeded = (e) => {
          const idb = e.target.result;
          if (!idb.objectStoreNames.contains(IDB_STORE)) {
            idb.createObjectStore(IDB_STORE, { keyPath: 'id' });
          }
          if (!idb.objectStoreNames.contains('semillas_guardadas')) {
            idb.createObjectStore('semillas_guardadas', { keyPath: 'infoHash' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }

    async function guardarHandleEnIDB(handle) {
      try {
        const idb = await abrirIDB();
        const tx = idb.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put({ id: 'carpeta_principal', handle: handle });
      } catch (e) { console.warn(e); }
    }

    async function recuperarHandleDeIDB() {
      try {
        const idb = await abrirIDB();
        return new Promise((resolve) => {
          const tx = idb.transaction(IDB_STORE, 'readonly');
          const req = tx.objectStore(IDB_STORE).get('carpeta_principal');
          req.onsuccess = () => resolve(req.result ? req.result.handle : null);
          req.onerror = () => resolve(null);
        });
      } catch (e) { return null; }
    }

    // --- NAVEGACIÓN ---
    const tabDescargar = document.getElementById('tab-descargar');
    const tabSubir = document.getElementById('tab-subir');
    const vistaDescargar = document.getElementById('vista-descargar');
    const vistaSubir = document.getElementById('vista-subir');

    function cambiarPestana(pestana) {
      if (pestana === 'descargar') {
        tabDescargar.classList.add('activa');
        tabSubir.classList.remove('activa');
        vistaDescargar.classList.add('activa');
        vistaSubir.classList.remove('activa');
      } else {
        tabSubir.classList.add('activa');
        tabDescargar.classList.remove('activa');
        vistaSubir.classList.add('activa');
        vistaDescargar.classList.remove('activa');
      }
    }

    tabDescargar.addEventListener('click', () => cambiarPestana('descargar'));
    tabSubir.addEventListener('click', () => cambiarPestana('subir'));
    document.getElementById('btn-refrescar').addEventListener('click', () => cargarCatalogo());

    let db = null;
    if (typeof supabase !== 'undefined') {
      db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }

    // Contraseña admin: solo se guarda su hash PBKDF2-SHA256 (con sal), nunca el texto.
    const ADMIN_SAL='578a2f0f27ac861a68d9b6033fea9848', ADMIN_HASH='055ce1cb619736c1cd1cc930d05bce89c6d9e97dac03d430ffd68ab06f2e070c', ADMIN_ITER=310000;
    const aHex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
    const deHex=s=>Uint8Array.from(s.match(/../g).map(x=>parseInt(x,16)));
    async function hashPass(p){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(p),'PBKDF2',false,['deriveBits']);
      return aHex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:deHex(ADMIN_SAL),iterations:ADMIN_ITER},k,256))}
    const SESION_DIAS=30;
    let modoAdmin=(()=>{const t=LS('pititorrent_admin_ok');return !!t&&Date.now()-t<SESION_DIAS*864e5})();
    const btnAdmin=document.getElementById('btn-admin'),dlg=document.getElementById('dlg-admin');
    function actualizarBotonAdmin(){btnAdmin.textContent=modoAdmin?'Modo Admin':'Admin';btnAdmin.classList.toggle('activo',modoAdmin)}
    actualizarBotonAdmin();
    btnAdmin.addEventListener('click',()=>{
      if(modoAdmin){modoAdmin=false;LS('pititorrent_admin_ok',null);actualizarBotonAdmin();cargarCatalogo();return}
      dlg.showModal()});
    document.getElementById('adm-cancel').addEventListener('click',()=>dlg.close());
    let fallos=0,bloqueoHasta=0;
    document.getElementById('form-admin').addEventListener('submit',async e=>{
      e.preventDefault();
      const m=document.getElementById('adm-msg'),pw=document.getElementById('adm-pass');
      if(Date.now()<bloqueoHasta){m.textContent='Demasiados intentos. Espera un minuto.';return}
      m.textContent='Comprobando...';
      const ok=(await hashPass(pw.value))===ADMIN_HASH;pw.value='';
      if(!ok){if(++fallos>=5){fallos=0;bloqueoHasta=Date.now()+60000}m.textContent='Contraseña incorrecta.';return}
      fallos=0;modoAdmin=true;LS('pititorrent_admin_ok',Date.now());m.textContent='';dlg.close();actualizarBotonAdmin();cargarCatalogo()});

    async function eliminarTorrent(id,titulo,infoHash){
      if(!db||!modoAdmin)return;
      if(!confirm('¿Eliminar "'+titulo+'" del catálogo?'))return;
      const{error}=await db.from('torrents').delete().eq('id',id);
      if(error)return alert('No se pudo eliminar: '+error.message);
      if(client&&infoHash){const x=client.get(infoHash);if(x)x.destroy();semillasActivas.delete(infoHash);renderizarPanelSemillas()}
      purgar(infoHash);quitarPendiente(infoHash);cargarCatalogo()}

    let client = null;
    try {
      if (typeof WebTorrent !== 'undefined') {
        client = new WebTorrent();
      }
    } catch (e) {}

    // Trackers estables y limpios
    const trackers = [
      'wss://tracker.openwebtorrent.com',
      'wss://tracker.webtorrent.dev'
    ];

    const semillasActivas = new Map();

    function registrarSemillaEnPanel(torrent, meta) {
      semillasActivas.set(torrent.infoHash, {
        torrent: torrent,
        titulo: meta.titulo || torrent.name,
        numArchivos: meta.numArchivos || torrent.files.length,
        tamanoTotal: meta.tamanoTotal || torrent.length,
        origen: meta.origen || 'Local',
        reanudado: Boolean(meta.reanudado)
      });
      renderizarPanelSemillas();
    }

    async function detenerSemilla(infoHash) {
      const registro = semillasActivas.get(infoHash);
      if (registro && registro.torrent) registro.torrent.destroy();
      semillasActivas.delete(infoHash);
      renderizarPanelSemillas();
    }

    function renderizarPanelSemillas() {
      const panel = document.getElementById('panel-semillas');
      const lista = document.getElementById('lista-semillas');
      if (semillasActivas.size === 0) {
        panel.style.display = 'none';
        return;
      }
      panel.style.display = 'block';
      let totalPeers = 0;
      let totalUploadSpeed = 0;
      let html = '';
      semillasActivas.forEach((item, hash) => {
        const t = item.torrent;
        const peers = t.numPeers || 0;
        const upSpeed = t.uploadSpeed || 0;
        const uploaded = t.uploaded || 0;
        totalPeers += peers;
        totalUploadSpeed += upSpeed;
        const icono = item.numArchivos > 1 ? '' : '';
        const claseOrigen = item.origen === 'Google Drive' ? 'badge-origen drive' : (item.origen.includes('Disco') ? 'badge-origen local-per' : 'badge-origen');

        html += `
          <div class="item-semilla">
            <div class="semilla-info">
              <div class="semilla-titulo">
                ${icono} ${esc(item.titulo)}
                <span class="${claseOrigen}">${esc(item.origen)}</span>
              </div>
              <div class="semilla-meta">
                ${item.numArchivos} archivo(s) - ${formatearTamano(item.tamanoTotal)}
              </div>
            </div>
            <div class="semilla-metricas">
              <div class="metrica-pill">Conectados: <strong>${peers}</strong></div>
              <div class="metrica-pill">Subida: <strong>${formatearVelocidad(upSpeed)}</strong></div>
              <div class="metrica-pill">Enviado: <strong>${formatearTamano(uploaded)}</strong></div>
              <button type="button" class="btn-detener-seed" data-hash="${esc(hash)}">Detener</button>
            </div>
          </div>
        `;
      });
      lista.innerHTML = html;
      document.getElementById('global-peers').textContent = totalPeers;
      document.getElementById('global-upload-speed').textContent = formatearVelocidad(totalUploadSpeed);
    }

    setInterval(() => {
      if (semillasActivas.size > 0) renderizarPanelSemillas();
    }, 1000);

    // --- REANUDACIÓN AUTOMÁTICA DESDE DISCO LOCAL ---
    async function comprobarReanudacionDiscoLocal() {
      if (!client || !db) return;
      const handleGuardado = await recuperarHandleDeIDB();
      if (!handleGuardado) return;

      const permiso = await handleGuardado.queryPermission({ mode: 'read' });
      if (permiso !== 'granted') {
        const infoSel = document.getElementById('info-seleccion');
        infoSel.textContent = `Carpeta vinculada detectada ("${handleGuardado.name}"). Haz clic en "Carpeta fija del PC" para reactivarla.`;
        return;
      }

      try {
        let lista = [];
        for await (const entry of handleGuardado.values()) {
          if (entry.kind === 'file') {
            const f = await entry.getFile();
            Object.defineProperty(f, 'webkitRelativePath', { value: handleGuardado.name + '/' + f.name });
            lista.push(f);
          } else if (entry.kind === 'directory') {
            const subs = await leerDirectorioRecursivo(entry, handleGuardado.name + '/' + entry.name + '/');
            lista = lista.concat(subs);
          }
        }
        if (lista.length === 0) return;

        const totalBytes = lista.reduce((acc, f) => acc + f.size, 0);
        const nombreTitulo = handleGuardado.name;

        client.seed(lista, { name: nombreTitulo, announce: trackers }, (torrent) => {
          if (!client.get(torrent.infoHash)) {
            registrarSemillaEnPanel(torrent, {
              titulo: nombreTitulo,
              numArchivos: lista.length,
              tamanoTotal: totalBytes,
              origen: 'Disco Local (Permanente)',
              reanudado: true
            });
          }
        });
      } catch (err) {
        console.warn('Error al reanudar disco local:', err);
      }
    }

    // --- SUBIDA TRADICIONAL ---
    let archivosSeleccionados = [];
    const inputArchivos = document.getElementById('input-archivos');
    const inputCarpeta = document.getElementById('input-carpeta');
    const infoSeleccion = document.getElementById('info-seleccion');
    const zonaDrop = document.getElementById('zona-drop');
    const inputTitulo = document.getElementById('titulo');

    document.getElementById('btn-elegir-archivos').addEventListener('click', () => inputArchivos.click());
    document.getElementById('btn-elegir-carpeta').addEventListener('click', () => inputCarpeta.click());

    function establecerSeleccion(listaArchivos, nombreSugerido) {
      archivosSeleccionados = Array.from(listaArchivos);
      if (archivosSeleccionados.length === 0) return;
      const totalBytes = archivosSeleccionados.reduce((acc, f) => acc + f.size, 0);
      infoSeleccion.classList.add('cargado');
      const nombreCarpeta = nombreSugerido || 'Selección';
      infoSeleccion.textContent = `/${archivosSeleccionados.length} archivos (${formatearTamano(totalBytes)})`;
      if (!inputTitulo.value) inputTitulo.value = nombreCarpeta;
    }

    inputArchivos.addEventListener('change', (e) => establecerSeleccion(e.target.files, e.target.files[0]?.name));
    inputCarpeta.addEventListener('change', (e) => establecerSeleccion(e.target.files, e.target.files[0]?.webkitRelativePath?.split('/')[0] || 'Carpeta'));

    document.getElementById('form-subir').addEventListener('submit', function(e) {
      e.preventDefault();
      if (!client || !db) return alert('Sistema no inicializado.');
      if (!modoAdmin) return alert('Solo el administrador puede publicar. Pulsa Admin.');
      if (!archivosSeleccionados || archivosSeleccionados.length === 0) {
        alert('Selecciona archivos o vincula una carpeta del PC.');
        return;
      }

      const btn = document.getElementById('btn-publicar');
      btn.disabled = true;
      btn.textContent = 'Preparando...';

      const nombreTorrent = inputTitulo.value.trim();
      const copia = [...archivosSeleccionados];
      const totalBytes = copia.reduce((acc, f) => acc + f.size, 0);

      client.seed(copia, { name: nombreTorrent, announce: trackers }, async (torrent) => {
        const { data: yaExiste } = await db.from('torrents').select('id').eq('info_hash', torrent.infoHash);
        if (!yaExiste || yaExiste.length === 0) {
          await insertarTorrent([{
            titulo: nombreTorrent,
            descripcion: document.getElementById('descripcion').value,
            imagen: document.getElementById('imagen').value,
            info_hash: torrent.infoHash
          }]);
        }

        btn.disabled = false;
        btn.textContent = 'Publicar';
        registrarSemillaEnPanel(torrent, { titulo: nombreTorrent, numArchivos: copia.length, tamanoTotal: totalBytes, origen: handleCarpetaLocal ? 'Disco Local (Permanente)' : 'Local' });

        e.target.reset();
        archivosSeleccionados = [];
        infoSeleccion.classList.remove('cargado');
        infoSeleccion.textContent = 'Elige lo que quieres compartir o arrástralo aquí';
        cargarCatalogo();
        cambiarPestana('descargar');
      });
    });

    // --- GOOGLE DRIVE ---
    let driveAccessToken = null;
    let driveFolderId = null;
    let driveArchivosProcesados = new Set();
    let intervaloDrive = null;

    const clientIdGuardado = localStorage.getItem('pititorrent_drive_client_id');
    const folderIdGuardado = localStorage.getItem('pititorrent_drive_folder_id');
    const driveActivoAntes = localStorage.getItem('pititorrent_drive_activo') === 'true';

    if (clientIdGuardado) document.getElementById('drive-client-id').value = clientIdGuardado;
    if (folderIdGuardado) document.getElementById('drive-folder-url').value = folderIdGuardado;

    if (driveActivoAntes && clientIdGuardado && folderIdGuardado) {
      document.getElementById('banner-reanudar').style.display = 'flex';
    }

    document.getElementById('btn-reanudar-drive-rapido').addEventListener('click', () => iniciarConexionDrive(clientIdGuardado, folderIdGuardado, true));
    document.getElementById('btn-olvidar-drive').addEventListener('click', () => {
      localStorage.removeItem('pititorrent_drive_activo');
      document.getElementById('banner-reanudar').style.display = 'none';
    });

    function extraerIdCarpetaDrive(entrada) {
      const limpio = entrada.trim();
      const matchFolders = limpio.match(/\/folders\/([a-zA-Z0-9_-]+)/);
      if (matchFolders) return matchFolders[1];
      const matchIdParam = limpio.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (matchIdParam) return matchIdParam[1];
      return limpio.replace(/[^a-zA-Z0-9_-]/g, '');
    }

    function logDrive(mensaje) {
      const box = document.getElementById('estado-drive-box');
      const logEl = document.getElementById('drive-log');
      box.classList.add('activo');
      const linea = document.createElement('div');
      linea.textContent = `[${new Date().toLocaleTimeString()}] ${mensaje}`;
      logEl.prepend(linea);
    }

    function iniciarConexionDrive(clientId, folderInput, esReanudacion = false) {
      driveFolderId = extraerIdCarpetaDrive(folderInput);
      localStorage.setItem('pititorrent_drive_client_id', clientId);
      localStorage.setItem('pititorrent_drive_folder_id', driveFolderId);

      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.readonly',
        callback: async (tokenResponse) => {
          if (tokenResponse.error) return logDrive('Error: ' + tokenResponse.error);
          driveAccessToken = tokenResponse.access_token;
          localStorage.setItem('pititorrent_drive_activo', 'true');
          document.getElementById('banner-reanudar').style.display = 'none';
          document.getElementById('btn-conectar-drive').disabled = true;
          document.getElementById('btn-sincronizar-ahora').style.display = 'inline-block';
          await sincronizarCarpetaDrive(esReanudacion);
          if (intervaloDrive) clearInterval(intervaloDrive);
          intervaloDrive = setInterval(() => sincronizarCarpetaDrive(false), 45000);
        }
      });
      tokenClient.requestAccessToken({ prompt: '' });
    }

    document.getElementById('form-drive').addEventListener('submit', (e) => {
      e.preventDefault();
      iniciarConexionDrive(document.getElementById('drive-client-id').value.trim(), document.getElementById('drive-folder-url').value.trim(), false);
    });

    async function sincronizarCarpetaDrive(esReanudacion) {
      if (!driveAccessToken || !driveFolderId) return;
      try {
        const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFolderId)}?fields=id,name`, { headers: { Authorization: `Bearer ${driveAccessToken}` } });
        const folderInfo = await metaRes.json();
        document.getElementById('drive-estado-titulo').textContent = `Drive: ${folderInfo.name}`;

        const query = encodeURIComponent(`'${driveFolderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`);
        const listRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,size,mimeType)`, { headers: { Authorization: `Bearer ${driveAccessToken}` } });
        const listData = await listRes.json();
        if (!listData.files) return;

        const { data: existentes } = await db.from('torrents').select('info_hash');
        const hashes = new Set((existentes || []).map(x => x.info_hash));

        for (const fMeta of listData.files) {
          if (driveArchivosProcesados.has(fMeta.id)) continue;
          const dlRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fMeta.id}?alt=media`, { headers: { Authorization: `Bearer ${driveAccessToken}` } });
          const blob = await dlRes.blob();
          const fileObj = new File([blob], fMeta.name, { type: fMeta.mimeType });

          client.seed([fileObj], { name: fMeta.name, announce: trackers }, async (torrent) => {
            driveArchivosProcesados.add(fMeta.id);
            registrarSemillaEnPanel(torrent, { titulo: fMeta.name, numArchivos: 1, tamanoTotal: fileObj.size, origen: 'Google Drive', reanudado: esReanudacion });
            if (!hashes.has(torrent.infoHash)) {
              await insertarTorrent([{ titulo: fMeta.name, descripcion: 'Google Drive Server', imagen: '', info_hash: torrent.infoHash }]);
              hashes.add(torrent.infoHash);
              cargarCatalogo();
            }
          });
        }
      } catch (err) { logDrive('Error sync: ' + err.message); }
    }

    // --- DESCARGA DIRECTA DE ARCHIVOS ---
    async function guardarArchivosDeTorrent(torrent, detallesEl) {
      if (detallesEl) detallesEl.textContent = 'Guardando archivos descargados...';
      
      let index = 0;
      for (const file of torrent.files) {
        index++;
        if (detallesEl) detallesEl.textContent = `Descargando archivo ${index} de ${torrent.files.length}: ${file.name}`;
        
        await new Promise((resolve) => {
          file.getBlobURL((err, url) => {
            if (!err && url) {
              const a = document.createElement('a');
              a.href = url;
              a.download = file.name;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            }
            setTimeout(resolve, 400);
          });
        });
      }

      if (detallesEl) detallesEl.textContent = '100% - ¡Todos los archivos guardados con éxito!';
    }

    // --- FUNCIÓN DE EMERGENCIA: FORZAR EXTRACCIÓN AL 100% ---
    function forzarDescarga100(infoHash, id) {
      const detalles = document.getElementById(`detalles-${id}`);
      const zona = document.getElementById(`prog-zona-${id}`);
      zona.style.display = 'block';
      detalles.textContent = 'Forzando extracción desde la red y caché...';

      let torrent = client.get(infoHash);
      if (torrent) {
        guardarArchivosDeTorrent(torrent, detalles);
        return;
      }

      // Si no está en memoria, lo añade y de inmediato fuerza la descarga
      const magnet = `magnet:?xt=urn:btih:${infoHash}&tr=` + trackers.map(encodeURIComponent).join('&tr=');
      client.add(magnet, opcionesTorrent(), (torrentForzado) => {
        detalles.textContent = 'Torrent cargado. Extrayendo archivos...';
        guardarArchivosDeTorrent(torrentForzado, detalles);
      });
    }

    function pintarCatalogo(datos) {
      if (!datos.length) { catalogoEl.textContent = 'No hay archivos publicados.'; return; }
      catalogoEl.innerHTML = '';
      datos.forEach(item => {
        if (!hashValido(item.info_hash)) return;
        const tarjeta = document.createElement('article');
        tarjeta.className = 'tarjeta';
        tarjeta.innerHTML = `
          <img src="${esc(imgCard(item.imagen) || IMG_DEF)}" referrerpolicy="no-referrer">
          <div class="contenido">
            <h3>${esc(item.titulo)}</h3>
            <p>${esc(item.descripcion || 'Sin descripción')}</p>
            <button class="btn" id="btn-${esc(item.id)}">Descargar</button>
            <button class="btn-forzar" id="forzar-${esc(item.id)}">Guardar otra vez (si ya lo descargaste)</button>
            ${modoAdmin ? `<button type="button" class="btn-borrar" id="del-${esc(item.id)}">Eliminar</button>` : ''}
            <div class="zona-progreso" id="prog-zona-${esc(item.id)}">
              <div class="barra-fondo"><div class="barra-progreso" id="barra-${esc(item.id)}"></div></div>
              <div class="detalles" id="detalles-${esc(item.id)}">Conectando...</div>
              <div class="stats-cliente-extra">
                <span>Gente: <strong id="peers-${esc(item.id)}">0</strong></span>
                <span>Bajada: <strong id="down-${esc(item.id)}">0 KB/s</strong></span>
                <span>Compartiendo: <strong id="up-${esc(item.id)}">0 KB/s</strong></span>
              </div>
            </div>
          </div>`;
        catalogoEl.appendChild(tarjeta);
        const im = tarjeta.querySelector('img'); im.addEventListener('error', () => { im.src = IMG_DEF; }, { once: true });

        document.getElementById(`btn-${esc(item.id)}`).addEventListener('click', () => iniciarDescarga(item.info_hash, item.id, item.titulo));
        document.getElementById(`forzar-${esc(item.id)}`).addEventListener('click', () => forzarDescarga100(item.info_hash, item.id));
        if (modoAdmin) {
          document.getElementById(`del-${esc(item.id)}`).addEventListener('click', () => eliminarTorrent(item.id, item.titulo, item.info_hash));
        }
      });
    }

    function iniciarDescarga(infoHash, id, titulo) {
      if (!client) return alert('WebTorrent no disponible.');
      const btn = document.getElementById(`btn-${id}`);
      const zona = document.getElementById(`prog-zona-${id}`);
      const barra = document.getElementById(`barra-${id}`);
      const detalles = document.getElementById(`detalles-${id}`);
      const peersEl = document.getElementById(`peers-${id}`);
      const downEl = document.getElementById(`down-${id}`);
      const upEl = document.getElementById(`up-${id}`);

      zona.style.display = 'block';

      let torrent = client.get(infoHash);
      if (torrent) {
        if (torrent.done || torrent.progress === 1) {
          detalles.textContent = '¡Descarga completada! Guardando archivos...';
          barra.style.width = '100%';
          guardarArchivosDeTorrent(torrent, detalles);
        } else {
          btn.disabled = true;
          btn.textContent = 'Descargando...';
        }
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Conectando…';
      detalles.textContent = 'Buscando el archivo...';

      if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persist().catch(() => {});
      }

      const magnet = `magnet:?xt=urn:btih:${infoHash}&tr=` + trackers.map(encodeURIComponent).join('&tr=');

      marcarPendiente(infoHash);
      client.add(magnet, opcionesTorrent(), (torrentRecuperado) => {
        torrent = torrentRecuperado;

        const interval = setInterval(() => {
          if (torrent.destroyed) return clearInterval(interval);
          const porc = Math.round(torrent.progress * 100);
          barra.style.width = porc + '%';
          if (peersEl) peersEl.textContent = torrent.numPeers;
          if (downEl) downEl.textContent = formatearVelocidad(torrent.downloadSpeed);
          if (upEl) upEl.textContent = formatearVelocidad(torrent.uploadSpeed);
          
          if (porc === 100) {
            detalles.textContent = '100% - Descarga completa';
          } else {
            detalles.textContent = `${porc}% completado (${formatearTamano(torrent.downloaded)} / ${formatearTamano(torrent.length)})`;
          }
        }, 500);

        torrent.on('done', () => {
          quitarPendiente(infoHash);
          clearInterval(interval);
          barra.style.width = '100%';
          btn.disabled = false;
          btn.textContent = '¡Guardado!';
          detalles.textContent = '¡Descarga terminada con éxito!';
          
          guardarArchivosDeTorrent(torrent, detalles);
          
          registrarSemillaEnPanel(torrent, { 
            titulo: titulo || torrent.name, 
            numArchivos: torrent.files.length, 
            tamanoTotal: torrent.length, 
            origen: 'Cliente (Seeding)' 
          });
        });
      });
    }

    let reanudado = false;
    async function cargarCatalogo() {
      if (!db) return;
      let datos = null;
      try {
        const r = await db.from('torrents').select('*').order('id', { ascending: false });
        if (!r.error && r.data) { datos = r.data; LS('pititorrent_catalogo', datos); }
      } catch (e) {}
      if (!datos) datos = LS('pititorrent_catalogo') || [];   // sin internet: último catálogo guardado
      pintarCatalogo(datos);
      if (!reanudado) {   // reanuda solas las descargas que quedaron a medias
        reanudado = true;
        datos.filter(d => pend().includes(d.info_hash)).forEach(d => iniciarDescarga(d.info_hash, d.id, d.titulo));
      }
    }
    document.getElementById('lista-semillas').addEventListener('click', e => {
      const b = e.target.closest('[data-hash]'); if (b) detenerSemilla(b.dataset.hash);
    });
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    cargarCatalogo();
    comprobarReanudacionDiscoLocal();
  