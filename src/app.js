const PB_URL = "https://webedit.api.qcumbergames.com";
const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

const COLLECTION_NAME = "cfrance";
const ADMIN_EMAIL = "admin@lapendery.nl";
const GALLERY_TAG = 100;
const FEATURES_TAG = 200;
const RULES_TAG = 201;
const FAQ_TAG = 202;
const PRICING_TAG = 203;
const MESSAGES_COLLECTION = "cfrance_messages";
const ADMIN_EMAILS_CONFIG_TAG = 300;

let adminNotificationEmails = "admin@lapendery.nl";
let isSaving = false;
let saveCooldownUntil = 0;
let hasLoadedCMSOnce = false;

let pictures = [];
let galleryRecords = [];
let cmsRecords = new Map();
let currentSlideIndex = 0;
let galleryInterval = null;

let giteFeatures = [
  "Eigen keuken", "Douche & ligbad", "Vaatwasser", "Televisie",
  "Houtkachel & stookhout", "Koffiezetapparaat", "Magnetron en oven",
  "Brandblusser/-deken", "Opgemaakte bedden", "Hand- en keukendoeken",
  "Waterkoker", "Privéterras met uitzicht", "Tuinmeubels & ligstoelen",
  "Gratis wifi", "Brandmelder", "Gratis eindschoonmaak",
  "3 hectare privéterrein", "Koelkast en vriezer"
];

let houseRules = [
  { type: "check", text: "Vogels in een kooi toegestaan" },
  { type: "check", text: "Aanbellen bij de eigenaren mag altijd" },
  { type: "cross", text: "Geen honden & overige dieren" },
  { type: "cross", text: "Roken niet toegestaan" }
];

let faqItems = [
  { q: "Is er een maximale verblijftijd?", a: "Nee. De gîte is de helft van het jaar geopend (april t/m oktober). U kunt gerust voor een langere periode verblijven." },
  { q: "Is er korting mogelijk?", a: "Er zijn geen vaste seizoenskortingen, maar bij een langer verblijf spreken we in overleg graag een aangepast tarief af." },
  { q: "Hoe zit het met brandveiligheid?", a: "Veiligheid staat voorop. Er zijn brandblussers, rookmelders en een branddeken in de gîte aanwezig." },
  { q: "Zijn huisdieren of roken toegestaan?", a: "Roken binnen is verboden. Honden en andere loslopende dieren zijn helaas niet toegestaan (vogels in een kooi wel in overleg)." }
];

let pricingRows = [
  { period: "1 week", price: "€395,-", note: "all-in" }
];

function showToast(message) {
  const existing = document.querySelector(".cms-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = "cms-toast";
  toast.innerText = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-50%) translateY(-10px)";
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

function showConfirmModal(question, onConfirm) {
  const modal = document.createElement("div");
  modal.className = "cms-modal-backdrop";
  modal.innerHTML = `
    <div class="cms-modal-box">
      <h3 style="margin-top:0; font-size:1.05rem;">Bevestigen</h3>
      <p style="margin: 12px 0 16px; font-size: 0.9rem;">${question}</p>
      <div class="cms-modal-actions">
        <button class="cms-btn-cancel" style="background:#eee; border:none; padding:8px 14px; border-radius:6px; cursor:pointer;">Annuleren</button>
        <button class="cms-btn-confirm" style="background:#dc2626; color:#fff; border:none; padding:8px 16px; border-radius:6px; cursor:pointer; font-weight:600;">Verwijderen</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector(".cms-btn-cancel").onclick = () => modal.remove();
  modal.querySelector(".cms-btn-confirm").onclick = () => {
    modal.remove();
    onConfirm();
  };
}

function refreshGalleryDOM() {
  const galCont = document.getElementById("galleryContainer");
  if (!galCont) return;
  galCont.innerHTML = generateGalleryHTML();
  initGallery();
  if (isLoggedIn()) {
    renderGalleryManager();
  }
}

function generateGalleryHTML() {
  const displayPics = pictures.length > 0 ? pictures : [];
  
  const slides = displayPics.map((src, i) => `
    <div class="gallery-slide" data-index="${i}">
      <img src="${src}" alt="Foto ${i + 1}" loading="lazy">
    </div>
  `).join("");

  const thumbs = displayPics.map((src, i) => `
    <div class="gallery-thumb ${i === 0 ? 'active' : ''}" data-thumb="${i}">
      <img src="${src}" alt="Abeelding ${i + 1}">
    </div>
  `).join("");

  return `
    <div class="gallery-wrapper" id="gallery">
      <div class="gallery-slides" id="gallerySlidesTrack">
        ${slides}
      </div>
      <button class="gallery-btn prev" id="galPrev" aria-label="Vorige">&#10094;</button>
      <button class="gallery-btn next" id="galNext" aria-label="Volgende">&#10095;</button>
    </div>
    
    <div class="gallery-filmstrip" id="galleryFilmstrip">
      ${thumbs}
    </div>

    <div id="galleryAdminPanel" class="cms-gallery-manager"></div>
  `;
}
function initGallery() {
  const gallery = document.getElementById("gallery");
  const track = document.getElementById("gallerySlidesTrack");
  const filmstrip = document.getElementById("galleryFilmstrip");
  if (!gallery || !track) return;

  if (galleryInterval) clearInterval(galleryInterval);

  const slides = track.querySelectorAll(".gallery-slide");
  const thumbs = filmstrip ? filmstrip.querySelectorAll(".gallery-thumb") : [];
  const btnPrev = document.getElementById("galPrev");
  const btnNext = document.getElementById("galNext");
  currentSlideIndex = 0;

  function showSlide(index) {
    if (slides.length === 0) return;
    if (index >= slides.length) currentSlideIndex = 0;
    else if (index < 0) currentSlideIndex = slides.length - 1;
    else currentSlideIndex = index;

    track.style.transform = `translateX(-${currentSlideIndex * 100}%)`;

    thumbs.forEach((th, i) => {
      th.classList.toggle("active", i === currentSlideIndex);
      if (i === currentSlideIndex && filmstrip) {
        const thumbLeft = th.offsetLeft;
        const thumbWidth = th.offsetWidth;
        const stripWidth = filmstrip.clientWidth;
        filmstrip.scrollLeft = thumbLeft - (stripWidth / 2) + (thumbWidth / 2);
      }
    });
  }

  function nextSlide() { showSlide(currentSlideIndex + 1); }

  function startAutoScroll() {
    if (galleryInterval) clearInterval(galleryInterval);
    galleryInterval = setInterval(nextSlide, 3500);
  }

  function stopAutoScroll() {
    if (galleryInterval) clearInterval(galleryInterval);
  }

  if (btnNext && btnPrev) {
    btnNext.onclick = () => { nextSlide(); startAutoScroll(); };
    btnPrev.onclick = () => { showSlide(currentSlideIndex - 1); startAutoScroll(); };
  }

  thumbs.forEach(thumb => {
    thumb.onclick = () => {
      showSlide(parseInt(thumb.dataset.thumb, 10));
      startAutoScroll();
    };
  });

  gallery.addEventListener("mouseenter", stopAutoScroll);
  gallery.addEventListener("mouseleave", startAutoScroll);

  showSlide(0);
  startAutoScroll();
}

function renderFeaturesTrack() {
  const track = document.getElementById("featuresTrack");
  if (!track) return;
  const listItems = [...giteFeatures, ...giteFeatures]
    .map(item => `<div class="cardincard check"><p>${item}</p></div>`)
    .join("");
  track.innerHTML = listItems;
}

function renderFeaturesAdminEditor() {
  const cont = document.getElementById("featuresAdminEditor");
  if (!cont) return;
  
  if (!isLoggedIn()) {
    cont.innerHTML = "";
    return;
  }

  cont.innerHTML = "";
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "margin-top: 14px; border-top: 1px dashed #ccc; padding-top: 10px;";

  const h4 = document.createElement("h4");
  h4.style.cssText = "margin: 0 0 8px 0; font-size: 0.9rem;";
  h4.innerText = "Voorzieningen beheren";
  wrapper.appendChild(h4);

  const list = document.createElement("div");
  list.style.cssText = "display: flex; flex-direction: column; gap: 6px;";

  giteFeatures.forEach((feat, i) => {
    const row = document.createElement("div");
    row.className = "cms-item-row";

    const span = document.createElement("span");
    span.className = "cms-editable-inline";
    span.setAttribute("data-feat-idx", i);
    span.setAttribute("data-maxlength", "40");
    span.setAttribute("contenteditable", "true");
    span.style.cssText = "flex:1; padding: 4px; border: 1px solid #ddd; border-radius: 4px;";
    span.innerText = feat;
    attachLengthLimiter(span);

    const controls = document.createElement("div");
    controls.className = "cms-item-controls";

    const delBtn = document.createElement("button");
    delBtn.className = "cms-mini-btn danger";
    delBtn.innerText = "✕";
    delBtn.onclick = () => {
      giteFeatures.splice(i, 1);
      renderFeaturesTrack();
      renderFeaturesAdminEditor();
    };

    controls.appendChild(delBtn);
    row.appendChild(span);
    row.appendChild(controls);
    list.appendChild(row);
  });

  const addBtn = document.createElement("button");
  addBtn.className = "cms-add-row-btn";
  addBtn.innerText = "+ Voorziening toevoegen";
  addBtn.onclick = () => {
    giteFeatures.push("Nieuwe voorziening");
    renderFeaturesTrack();
    renderFeaturesAdminEditor();
  };

  wrapper.appendChild(list);
  wrapper.appendChild(addBtn);
  cont.appendChild(wrapper);
}

function renderHouseRules() {
  const cont = document.getElementById("houseRulesContainer");
  if (!cont) return;
  cont.innerHTML = "";

  const list = document.createElement("div");
  list.style.cssText = "display:flex; flex-direction:column; gap:6px;";

  houseRules.forEach((r, i) => {
    const row = document.createElement("div");
    row.className = "cms-item-row";

    const card = document.createElement("div");
    card.className = `cardincard ${r.type}`;
    card.style.cssText = "flex:1; margin:0;";

    const p = document.createElement("p");
    p.className = "cms-editable-inline";
    p.setAttribute("data-rule-idx", i);
    p.setAttribute("data-maxlength", "80");
    if (isLoggedIn()) p.setAttribute("contenteditable", "true");
    p.innerText = r.text;
    attachLengthLimiter(p);

    card.appendChild(p);
    row.appendChild(card);

    if (isLoggedIn()) {
      const controls = document.createElement("div");
      controls.className = "cms-item-controls";

      const toggleBtn = document.createElement("button");
      toggleBtn.className = "cms-mini-btn";
      toggleBtn.innerText = r.type === "check" ? "Vinkje" : "Kruis";
      toggleBtn.onclick = () => {
        r.type = r.type === "check" ? "cross" : "check";
        renderHouseRules();
      };

      const delBtn = document.createElement("button");
      delBtn.className = "cms-mini-btn danger";
      delBtn.innerText = "✕";
      delBtn.onclick = () => {
        houseRules.splice(i, 1);
        renderHouseRules();
      };

      controls.appendChild(toggleBtn);
      controls.appendChild(delBtn);
      row.appendChild(controls);
    }

    list.appendChild(row);
  });

  cont.appendChild(list);

  if (isLoggedIn()) {
    const addBtn = document.createElement("button");
    addBtn.className = "cms-add-row-btn";
    addBtn.innerText = "+ Regel toevoegen";
    addBtn.onclick = () => {
      houseRules.push({ type: "check", text: "Nieuwe regel" });
      renderHouseRules();
    };
    cont.appendChild(addBtn);
  }
}

function renderPricingTable() {
  const tbody = document.getElementById("pricingTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  pricingRows.forEach((row, i) => {
    const tr = document.createElement("tr");

    const tdPeriod = document.createElement("td");
    tdPeriod.className = "cms-editable-inline";
    tdPeriod.setAttribute("data-price-period-idx", i);
    tdPeriod.setAttribute("data-maxlength", "40");
    if (isLoggedIn()) tdPeriod.setAttribute("contenteditable", "true");
    tdPeriod.innerText = row.period;
    attachLengthLimiter(tdPeriod);

    const tdPrice = document.createElement("td");
    
    const strongPrice = document.createElement("strong");
    strongPrice.className = "cms-editable-inline";
    strongPrice.setAttribute("data-price-val-idx", i);
    strongPrice.setAttribute("data-maxlength", "30");
    if (isLoggedIn()) strongPrice.setAttribute("contenteditable", "true");
    strongPrice.innerText = row.price;
    attachLengthLimiter(strongPrice);

    const spanNote = document.createElement("span");
    spanNote.className = "cms-editable-inline";
    spanNote.setAttribute("data-price-note-idx", i);
    spanNote.setAttribute("data-maxlength", "30");
    spanNote.style.marginLeft = "6px";
    if (isLoggedIn()) spanNote.setAttribute("contenteditable", "true");
    spanNote.innerText = row.note;
    attachLengthLimiter(spanNote);

    tdPrice.appendChild(strongPrice);
    tdPrice.appendChild(spanNote);

    if (isLoggedIn()) {
      const delBtn = document.createElement("button");
      delBtn.className = "cms-mini-btn danger";
      delBtn.style.marginLeft = "10px";
      delBtn.innerText = "✕";
      delBtn.onclick = () => {
        pricingRows.splice(i, 1);
        renderPricingTable();
      };
      tdPrice.appendChild(delBtn);
    }

    tr.appendChild(tdPeriod);
    tr.appendChild(tdPrice);
    tbody.appendChild(tr);
  });

  const addBtnCont = document.getElementById("pricingAddRowContainer");
  if (addBtnCont) {
    addBtnCont.innerHTML = isLoggedIn() ? `<button class="cms-add-row-btn" onclick="addPricingRow()">+ Tariefregel toevoegen</button>` : "";
  }
}

function addPricingRow() {
  pricingRows.push({ period: "Nieuwe periode", price: "€0,-", note: "all-in" });
  renderPricingTable();
}

function renderFAQ() {
  const cont = document.getElementById("faqContainer");
  if (!cont) return;
  cont.innerHTML = "";

  const list = document.createElement("div");
  list.style.cssText = "display:flex; flex-direction:column; gap:8px;";

  faqItems.forEach((item, i) => {
    const rowWrap = document.createElement("div");
    rowWrap.style.cssText = "border-bottom: 1px solid #eee; padding-bottom: 8px;";

    const row = document.createElement("div");
    row.className = "cms-item-row";
    row.style.marginBottom = "4px";

    const details = document.createElement("details");
    details.className = "faq-item";
    details.style.flex = "1";
    if (isLoggedIn()) details.open = true;

    const summary = document.createElement("summary");
    summary.className = "cms-editable-inline";
    summary.setAttribute("data-faq-q-idx", i);
    summary.setAttribute("data-maxlength", "90");
    if (isLoggedIn()) summary.setAttribute("contenteditable", "true");
    summary.innerText = item.q;
    attachLengthLimiter(summary);

    const ansP = document.createElement("p");
    ansP.className = "cms-editable-inline";
    ansP.setAttribute("data-faq-a-idx", i);
    ansP.setAttribute("data-maxlength", "300");
    ansP.style.marginTop = "6px";
    if (isLoggedIn()) ansP.setAttribute("contenteditable", "true");
    ansP.innerText = item.a;
    attachLengthLimiter(ansP);

    details.appendChild(summary);
    details.appendChild(ansP);
    row.appendChild(details);

    if (isLoggedIn()) {
      const controls = document.createElement("div");
      controls.className = "cms-item-controls";

      const delBtn = document.createElement("button");
      delBtn.className = "cms-mini-btn danger";
      delBtn.innerText = "✕";
      delBtn.onclick = () => {
        faqItems.splice(i, 1);
        renderFAQ();
      };

      controls.appendChild(delBtn);
      row.appendChild(controls);
    }

    rowWrap.appendChild(row);
    list.appendChild(rowWrap);
  });

  cont.appendChild(list);

  if (isLoggedIn()) {
    const addBtn = document.createElement("button");
    addBtn.className = "cms-add-row-btn";
    addBtn.innerText = "+ Vraag toevoegen";
    addBtn.onclick = () => {
      faqItems.push({ q: "Nieuwe vraag?", a: "Antwoord op de vraag hier invullen." });
      renderFAQ();
    };
    cont.appendChild(addBtn);
  }
}

const views = {
  gite: `
    <div class="column">
      <div class="card">
        <h2 data-tag="1" data-maxlength="50">De Gîte</h2>
        <p data-tag="2" data-maxlength="350">Lekker ontspannen in een heerlijke stoel na een dag in de natuur? Dat kan bij La Pendery. Een rustig, vrijstaand verblijf voor 2 personen.</p>
        
        <h3 data-tag="3" data-maxlength="50">Geschiedenis</h3>
        <p data-tag="4" data-maxlength="450">La Pendery was van oorsprong een klein gehuchtje rond een gezamenlijke "court", met een grote boerderij en arbeiderswoningen. De huisjes zijn inmiddels verdwenen, maar de meer dan 200 jaar oude boerderij en schuur staan er nog. Het ligt aan een rustige weg richting Arfeuilles, aan de rand van de Monts de la Madeleine.</p>
        
        <h3 data-tag="10" data-maxlength="50">Huisregels</h3>
        <div id="houseRulesContainer"></div>
      </div>

      <div class="card">
        <h2 data-tag="11" data-maxlength="50">Inventaris & Veiligheid</h2>
        <p data-tag="12" data-maxlength="150">Aanwezige voorzieningen in en rondom het verblijf:</p>
        <div class="features-scroll-box">
          <div class="features-track" id="featuresTrack"></div>
        </div>
        <div id="featuresAdminEditor"></div>
        <p style="margin-top: 10px; font-size: 0.85rem; color: #666;" data-tag="9" data-maxlength="120">(Let op: medicijnen en AED zijn niet standaard op locatie aanwezig).</p>
      </div>
    </div>

    <div class="card" style="margin-top: 16px;">
      <h2 data-tag="13" data-maxlength="50">Foto's</h2>
      <div id="galleryContainer">
        ${generateGalleryHTML()}
      </div>
    </div>
  `,

  omgeving: `
    <div class="card" style="margin-bottom: 16px;">
      <h2 data-tag="20" data-maxlength="50">De Omgeving</h2>
      <p data-tag="21" data-maxlength="300">La Pendery ligt op circa 3 minuten rijden naast het dorpje <strong>Arfeuilles</strong>, aan de rand van de <em>Monts de la Madeleine</em>. Vanaf midden-Nederland is het zo'n 900 km rijden en prima in één dag te doen.</p>
    </div>
    
    <div class="column">
      <div class="card">
        <h3 data-tag="22" data-maxlength="50">Arfeuilles</h3>
        <p data-tag="23" data-maxlength="300">Een karakteristiek Frans dorpje en dé plek om te wandelen, te fietsen en actief bezig te zijn in de heuvels. Na afloop kun je natuurlijk rustig bijkomen bij het huis.</p>
      </div>
      <div class="card">
        <h3 data-tag="24" data-maxlength="50">Vichy & Roanne</h3>
        <p data-tag="25" data-maxlength="300">Binnen 30 tot 35 kilometer bereikt u de steden Vichy en Roanne voor cultuur, winkels, restaurants en de wijngaarden van de Côte Roannaise.</p>
      </div>
    </div>

    <div class="card" style="margin-top: 16px;">
      <h2 data-tag="26" data-maxlength="50">Kaart</h2>
      <div class="map-container">
        <iframe 
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d25000!2d3.744396576856015!3d46.17190267109405!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47f1529c30e1776f%3A0x88ba8aa757769ffc!2sLa%20Pendery!5e0!3m2!1snl!2snl!4v1729315000000!5m2!1snl!2snl" 
          loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen="" title="La Pendery">
        </iframe>
      </div>
    </div>
  `,

  prijzen: `
    <div class="column">
      <div class="card">
        <h2 data-tag="30" data-maxlength="50">Tarieven</h2>
        <p data-tag="31" data-maxlength="200">Wij hanteren één vaste, overzichtelijke all-in prijs voor het verblijf:</p>
        
        <table class="simple-table">
          <thead>
            <tr>
              <th data-tag="60" data-maxlength="30">Periode</th>
              <th data-tag="61" data-maxlength="30">Tarief</th>
            </tr>
          </thead>
          <tbody id="pricingTableBody"></tbody>
        </table>
        <div id="pricingAddRowContainer"></div>
        
        <p style="margin-top: 12px; font-size: 0.9rem;" data-tag="34" data-maxlength="160">
          <em>* Inclusief toeristenbelasting, eindschoonmaak, beddengoed, handdoeken en aanmaakhout.</em>
        </p>
      </div>

     <div class="card">
        <h2 data-tag="62" data-maxlength="50">Veelgestelde Vragen</h2>
        <div id="faqContainer"></div>
      </div>
    </div>
  `,

  contact: `
    <div class="column">
      <div class="card">
        <h2 data-tag="50" data-maxlength="50">Contact Opnemen</h2>
        <p data-tag="51" data-maxlength="250">Vragen over de gîte of een verblijf boeken? Neem rechtstreeks contact op met Ad en Diny via telefoon of stuur een bericht.</p>
        
        <div class="cardincard">
          <p><span data-tag="56" data-maxlength="20">Telefoon:</span> <strong data-tag="52" data-maxlength="30">+31 6 44682172</strong></p>
        </div>

        <form class="contact-form" id="contactForm" onsubmit="handleContactSubmit(event)">
          <div class="form-group">
            <label for="contactNaam" data-tag="70" data-maxlength="30">Naam *</label>
            <input type="text" id="contactNaam" required placeholder="Uw naam">
          </div>
          <div class="form-group">
            <label for="contactEmail" data-tag="71" data-maxlength="30">E-mailadres *</label>
            <input type="email" id="contactEmail" required placeholder="naam@voorbeeld.nl">
          </div>
          <div class="form-group">
            <label for="contactBericht" data-tag="72" data-maxlength="30">Bericht *</label>
            <textarea id="contactBericht" rows="4" required placeholder="Typ hier uw vraag..."></textarea>
          </div>
          <p style="font-size: 16px">Door op Versturen te klikken gaat u akkoord met de privacyverklaring.</p>
          <details class="faq-item" style="margin-top: 20px;">
  <summary data-tag="90" data-maxlength="60">Privacyverklaring (AVG)</summary>
  <div style="padding: 12px 16px; font-size: 0.9rem; line-height: 1.6; color: #444;">
    <p><strong>Wie zijn wij?</strong><br>
    La Pendery, gelegen te Arfeuilles (Frankrijk). Contactpersoon voor gegevensverwerking: Ad en Diny.</p>
    
    <p style="margin-top: 8px;"><strong>Welke persoonsgegevens verwerken wij?</strong><br>
    Via het formulier verzamelen wij uitsluitend uw opgegeven naam, e-mailadres en de inhoud van uw bericht.</p>
    
    <p style="margin-top: 8px;"><strong>Waarom verwerken wij deze gegevens?</strong><br>
    Op basis van gerechtvaardigd belang: om contact met u op te nemen, vragen te beantwoorden of een voorgenomen boeking te bespreken.</p>
    
    <p style="margin-top: 8px;"><strong>Bewaartermijn en delen met derden</strong><br>
    Uw gegevens worden veilig bewaard en nooit aan derden verkocht of verstrekt. Zodra het contact is afgerond en er geen administratieve verplichting (zoals een geboekt verblijf) aan vastzit, worden berichten periodiek handmatig gewist.</p>
    
    <p style="margin-top: 8px;"><strong>Uw rechten</strong><br>
    Uw hebt het recht om uw gegevens in te zien, te laten corrigeren of direct te laten verwijderen. Neem hiervoor eenvoudig contact op via het formulier of per telefoon.</p>
  </div>
</details>
          <button type="submit" id="contactSubmitBtn" data-tag="73" data-maxlength="30" style="background: #2d3e2f; color: #fff; margin-top: 6px;">Versturen</button>
        </form>

        <div id="adminMessagesContainer" class="admin-messages-box"></div>
      </div>

      <div class="card">
        <h2 data-tag="80" data-maxlength="50">Reserveren & Reviews</h2>
        <p data-tag="81" data-maxlength="200">Wilt u direct boeken via Gîtes.com of actuele kalenders bekijken?</p>
        
        <div class="gites-calendar-container" style="overflow: hidden; border-radius: 8px;">
          <iframe 
            src="https://www.gites.com/nl/vakantiehuizen/9918/embed" 
            style="max-width: 760px; width: 100%; height: 340px; border: 0;"
            scrolling="no"
            loading="lazy" 
            title="Beschikbaarheidskalender La Pendery">
          </iframe>
        </div>

        <div style="margin-top: 14px; text-align: center;">
          <a href="https://www.gites.com/nl/vakantiehuizen/auvergne-rhone-alpes/allier/arfeuilles/la-pendery-9918" 
             target="_blank" rel="noopener noreferrer" data-tag="82" data-maxlength="50"
             style="display: inline-block; background: #2d3e2f; color: #faf7f2; padding: 10px 16px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 0.9rem;">
            Boek direct op Gîtes.com
          </a>
        </div>

        <h3 data-tag="83" data-maxlength="50">Google Maps Reviews</h3>
        <p data-tag="84" data-maxlength="200">La Pendery heeft een score van <strong>4,8/5 sterren</strong> op Google Maps en een score van <strong>10/10</strong> op gites.com!</p>
        <div style="margin-top: 12px;">
          <a href="https://www.google.com/maps/place/La+Pendery/@46.1707317,3.7409907,16z/data=!4m15!1m8!3m7!1s0x47f1529a27f4b503:0x2ad55342eaf9afc5!2sLa+Pendery,+03640+Arfeuilles,+Frankrijk!3b1!8m2!3d46.17184!4d3.747063!16s%2Fg%2F1tjxd_gm!3m5!1s0x47f1529c30e1776f:0x88ba8aa757769ffc!8m2!3d46.1719027!4d3.7469715!16s%2Fg%2F11g9q3w_m5" 
             target="_blank" rel="noopener noreferrer" data-tag="85" data-maxlength="50"
             style="display: inline-block; background: #2d3e2f; color: #faf7f2; padding: 8px 14px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 0.9rem;">
            Bekijk locatie en reviews op Google Maps
          </a>
        </div>
      </div>
    </div>
  `
};

function isLoggedIn() {
  return pb.authStore.isValid && pb.authStore.model?.email === ADMIN_EMAIL;
}
let connectionAttempts = 0;
const MAX_ATTEMPTS = 5;

async function loadCMSData() {
  if (isSaving || Date.now() < saveCooldownUntil) return;

  try {
    const records = await pb.collection(COLLECTION_NAME).getFullList({ sort: 'created' });
    cmsRecords.clear();
    galleryRecords = [];

    const loadedPictures = [];

    records.forEach(rec => {
      const tag = Number(rec.tag);

      if (tag === GALLERY_TAG && rec.isfilenottext && rec.file) {
        galleryRecords.push(rec);
        if (Array.isArray(rec.file)) {
          rec.file.forEach(f => {
            if (f) loadedPictures.push(pb.files.getUrl(rec, f));
          });
        } else {
          loadedPictures.push(pb.files.getUrl(rec, rec.file));
        }
      } else if (tag === FEATURES_TAG && rec.value) {
        try { giteFeatures = JSON.parse(rec.value); } catch (e) {}
      } else if (tag === RULES_TAG && rec.value) {
        try { houseRules = JSON.parse(rec.value); } catch (e) {}
      } else if (tag === FAQ_TAG && rec.value) {
        try { faqItems = JSON.parse(rec.value); } catch (e) {}
      } else if (tag === PRICING_TAG && rec.value) {
        try { pricingRows = JSON.parse(rec.value); } catch (e) {}
      } else if (tag === ADMIN_EMAILS_CONFIG_TAG && rec.value) {
        adminNotificationEmails = rec.value;
      } else {
        cmsRecords.set(tag, rec);
      }
    });

    pictures = loadedPictures.length > 0 ? loadedPictures : [];
    hasLoadedCMSOnce = true;
    connectionAttempts = 0;
    
    refreshGalleryDOM();
    renderFeaturesTrack();
    renderHouseRules();
    renderPricingTable();
    renderFAQ();
    applyCMSDataToDOM();

    if (isLoggedIn()) activateEditMode();
  } catch (err) {
    connectionAttempts++;
    console.warn(`Verbinding met PocketBase mislukt (poging ${connectionAttempts}/${MAX_ATTEMPTS}):`, err);

    if (connectionAttempts < MAX_ATTEMPTS) {
      showToast(`Verbinding verbroken. Opnieuw proberen (${connectionAttempts}/${MAX_ATTEMPTS})...`);

      setTimeout(loadCMSData, 2500);
    } else {
      handleSyncFailure();
    }
  }
}
function handleSyncFailure() {
  hasLoadedCMSOnce = false;

  if (isLoggedIn()) {
    showToast("Geen verbinding met de server. U wordt uitgelogd om dataverlies te voorkomen.");
    pb.authStore.clear();
    
    document.body.classList.remove("admin-logged-in");
    const bar = document.getElementById("cms-floating-bar");
    if (bar) bar.style.display = "none";
  } else {
    showToast("Kan geen verbinding maken met de database. Pagina wordt opnieuw geladen...");
  }

  setTimeout(() => {
    location.reload();
  }, 3000);
}
function applyCMSDataToDOM() {
  document.querySelectorAll('[data-tag]').forEach(el => {
    const tag = Number(el.getAttribute('data-tag'));
    const rec = cmsRecords.get(tag);
    if (rec && !rec.isfilenottext && rec.value !== undefined && rec.value !== null) {
      el.innerHTML = rec.value;
    }
  });
}

function activateEditMode() {
  document.body.classList.add("admin-logged-in");
  renderAdminMessages();
  
  document.querySelectorAll('[data-tag], .cms-editable-inline').forEach(el => {
    el.setAttribute("contenteditable", "true");
    attachLengthLimiter(el);
  });

  const floatBar = document.getElementById("cms-floating-bar");
  if (floatBar) floatBar.style.display = "flex";

  const lockBtn = document.getElementById("cms-lock-btn");
  if (lockBtn) lockBtn.style.display = "none";

  renderGalleryManager();
  renderFeaturesAdminEditor();
  renderHouseRules();
  renderPricingTable();
  renderFAQ();
  initSelectionBubble();
}

function attachLengthLimiter(el) {
  if (el.dataset.limiterAttached) return;
  el.dataset.limiterAttached = "true";

  const max = parseInt(el.getAttribute("data-maxlength") || "1000", 10);
  el.addEventListener("input", () => {
    if (el.innerText.length > max) {
      el.innerText = el.innerText.substring(0, max);
      showToast(`Limiet van ${max} tekens bereikt`);
    }
  });
}
function renderGalleryManager() {
  const panel = document.getElementById("galleryAdminPanel");
  if (!panel || !isLoggedIn()) return;

  panel.innerHTML = "";

  const header = document.createElement("div");
  header.style.cssText = "display:flex; justify-content:space-between; align-items:center;";
  header.innerHTML = `
    <span style="font-weight:600; font-size:0.85rem;">Foto's beheren (${pictures.length}/50)</span>
    <label style="background:#2d3e2f; color:#fff; padding:4px 10px; border-radius:4px; font-size:0.8rem; cursor:pointer;">
      + Foto's toevoegen
      <input type="file" accept="image/jpeg,image/png,image/webp" multiple style="display:none;" id="cmsUploadInput">
    </label>
  `;
  panel.appendChild(header);

  header.querySelector("#cmsUploadInput").addEventListener("change", (e) => handleGalleryUpload(e.target));

  const grid = document.createElement("div");
  grid.className = "cms-thumb-grid";

  galleryRecords.forEach(rec => {
    const files = Array.isArray(rec.file) ? rec.file : [rec.file];
    files.forEach(filename => {
      if (!filename) return;
      const item = document.createElement("div");
      item.className = "cms-thumb-item";

      const img = document.createElement("img");
      img.src = pb.files.getUrl(rec, filename);

      const delBtn = document.createElement("button");
      delBtn.innerText = "✕";
      delBtn.title = "Verwijderen";
      delBtn.onclick = () => {
        showConfirmModal("Weet je zeker dat je deze afbeelding wilt verwijderen?", async () => {
          try {
            await pb.collection(COLLECTION_NAME).delete(rec.id);
            await loadCMSData();
            showToast("Foto verwijderd");
          } catch (err) {
            showToast("Fout bij verwijderen");
          }
        });
      };

      item.appendChild(img);
      item.appendChild(delBtn);
      grid.appendChild(item);
    });
  });

  panel.appendChild(grid);
}

function compressImageIfNeeded(file, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    if (file.size <= maxBytes) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onerror = () => reject(new Error("Bestand kon niet gelezen worden"));
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onerror = () => reject(new Error("Afbeelding laden mislukt"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        const maxDim = 2048;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.85;
        function tryCompress() {
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error("Canvas export mislukt"));
              return;
            }
            if (blob.size <= maxBytes || quality <= 0.4) {
              const cleanName = file.name.replace(/\.[^/.]+\$/, "") + ".webp";
              const resultFile = new File([blob], cleanName, { type: "image/webp" });
              resolve(resultFile);
            } else {
              quality -= 0.15;
              tryCompress();
            }
          }, "image/webp", quality);
        }

        tryCompress();
      };
    };
  });
}

async function handleGalleryUpload(input) {
  if (!input.files || input.files.length === 0) return;

  const files = Array.from(input.files);
  const currentCount = galleryRecords.length;
  const MAX_PHOTOS = 50;

  if (currentCount + files.length > MAX_PHOTOS) {
    showToast(`Maximaal ${MAX_PHOTOS} foto's toegestaan. Er kunnen nog ${Math.max(0, MAX_PHOTOS - currentCount)} bij.`);
    return;
  }

  showToast(`Bezig met verwerken en uploaden van ${files.length} bestand(en)...`);

  for (let file of files) {
    try {
      const preparedFile = await compressImageIfNeeded(file, 1024 * 1024);

      if (preparedFile.size > 5 * 1024 * 1024) {
        showToast(`Bestand ${file.name} overschrijdt de 5 MB limiet.`);
        continue;
      }

      const formData = new FormData();
      formData.append("file", preparedFile);
      formData.append("tag", GALLERY_TAG);
      formData.append("isfilenottext", true);

      await pb.collection(COLLECTION_NAME).create(formData);
    } catch (err) {
      showToast(`Uploadfout voor ${file.name}: ${err.message}`);
    }
  }

  await loadCMSData();
  showToast("Foto's succesvol verwerkt!");
}

function initSelectionBubble() {
  let bubble = document.getElementById("cms-text-bubble");
  if (!bubble) {
    bubble = document.createElement("div");
    bubble.id = "cms-text-bubble";
    bubble.innerHTML = `
      <button id="cmsBubbleBold" title="Vetgedrukt"><strong>B</strong></button>
      <button id="cmsBubbleItalic" title="Cursief"><em>I</em></button>
    `;
    document.body.appendChild(bubble);

    document.getElementById("cmsBubbleBold").onmousedown = (e) => {
      e.preventDefault();
      document.execCommand("bold", false, null);
      updateBubblePosition();
    };

    document.getElementById("cmsBubbleItalic").onmousedown = (e) => {
      e.preventDefault();
      document.execCommand("italic", false, null);
      updateBubblePosition();
    };
  }

  function updateBubblePosition() {
    if (!isLoggedIn()) {
      bubble.style.display = "none";
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      bubble.style.display = "none";
      return;
    }

    const activeElement = document.activeElement;
    const isEditing = activeElement && (
      activeElement.isContentEditable || 
      activeElement.closest('[contenteditable="true"]')
    );

    if (!isEditing) {
      bubble.style.display = "none";
      return;
    }

    const range = selection.getRangeAt(0);
    let rect = range.getBoundingClientRect();

    if (rect.width === 0 && rect.height === 0) {
      const parentNode = range.startContainer.nodeType === Node.TEXT_NODE
        ? range.startContainer.parentElement
        : range.startContainer;
      rect = parentNode.getBoundingClientRect();
    }

    if (!rect || (rect.top === 0 && rect.left === 0)) {
      bubble.style.display = "none";
      return;
    }

    bubble.style.display = "flex";
    bubble.style.top = `${window.scrollY + rect.top - 42}px`;
    bubble.style.left = `${window.scrollX + rect.left + (rect.width / 2) - 30}px`;
  }

  document.addEventListener("selectionchange", updateBubblePosition);
  document.addEventListener("keyup", updateBubblePosition);
  document.addEventListener("click", updateBubblePosition);
}
async function saveAllTextChanges() {
  if (isSaving) return;

  if (!hasLoadedCMSOnce) {
    showToast("Fout: Geen verbinding met de database. Pagina verversen a.u.b.");
    return;
  }

  isSaving = true;

  const saveBtn = document.getElementById("cmsSaveBtn");
  if (saveBtn) saveBtn.innerText = "⏳ Bezig met opslaan...";

  try {
    document.querySelectorAll('[data-feat-idx]').forEach(el => {
      const idx = parseInt(el.getAttribute('data-feat-idx'), 10);
      if (!isNaN(idx) && giteFeatures[idx] !== undefined) {
        giteFeatures[idx] = el.innerText.trim();
      }
    });

    document.querySelectorAll('[data-rule-idx]').forEach(el => {
      const idx = parseInt(el.getAttribute('data-rule-idx'), 10);
      if (!isNaN(idx) && houseRules[idx] !== undefined) {
        houseRules[idx].text = el.innerText.trim();
      }
    });

    document.querySelectorAll('[data-price-period-idx]').forEach(el => {
      const idx = parseInt(el.getAttribute('data-price-period-idx'), 10);
      if (!isNaN(idx) && pricingRows[idx] !== undefined) {
        pricingRows[idx].period = el.innerText.trim();
      }
    });
    document.querySelectorAll('[data-price-val-idx]').forEach(el => {
      const idx = parseInt(el.getAttribute('data-price-val-idx'), 10);
      if (!isNaN(idx) && pricingRows[idx] !== undefined) {
        pricingRows[idx].price = el.innerText.trim();
      }
    });
    document.querySelectorAll('[data-price-note-idx]').forEach(el => {
      const idx = parseInt(el.getAttribute('data-price-note-idx'), 10);
      if (!isNaN(idx) && pricingRows[idx] !== undefined) {
        pricingRows[idx].note = el.innerText.trim();
      }
    });

    document.querySelectorAll('[data-faq-q-idx]').forEach(el => {
      const idx = parseInt(el.getAttribute('data-faq-q-idx'), 10);
      if (!isNaN(idx) && faqItems[idx] !== undefined) {
        faqItems[idx].q = el.innerText.trim();
      }
    });
    document.querySelectorAll('[data-faq-a-idx]').forEach(el => {
      const idx = parseInt(el.getAttribute('data-faq-a-idx'), 10);
      if (!isNaN(idx) && faqItems[idx] !== undefined) {
        faqItems[idx].a = el.innerText.trim();
      }
    });

    async function syncJSONTag(tag, dataObj) {
      const strVal = JSON.stringify(dataObj);
      const rec = cmsRecords.get(tag);
      if (rec) {
        if (rec.value !== strVal) {
          const res = await pb.collection(COLLECTION_NAME).update(rec.id, { value: strVal });
          cmsRecords.set(tag, res);
        }
      } else {
        const created = await pb.collection(COLLECTION_NAME).create({
          tag: tag,
          value: strVal,
          isfilenottext: false
        });
        cmsRecords.set(tag, created);
      }
    }

    await syncJSONTag(FEATURES_TAG, giteFeatures);
    await syncJSONTag(RULES_TAG, houseRules);
    await syncJSONTag(PRICING_TAG, pricingRows);
    await syncJSONTag(FAQ_TAG, faqItems);

    const editables = document.querySelectorAll('[data-tag]');
    for (let el of editables) {
      const tag = Number(el.getAttribute('data-tag'));
      const val = el.innerHTML.trim();
      const existing = cmsRecords.get(tag);

      if (existing) {
        if (val !== existing.value) {
          const res = await pb.collection(COLLECTION_NAME).update(existing.id, { value: val });
          cmsRecords.set(tag, res);
        }
      } else {
        const res = await pb.collection(COLLECTION_NAME).create({
          tag: tag,
          value: val,
          isfilenottext: false
        });
        cmsRecords.set(tag, res);
      }
    }

    const emailConfigInput = document.getElementById("adminEmailConfigInput");
    if (emailConfigInput) {
      adminNotificationEmails = emailConfigInput.value.trim();
      const rec = cmsRecords.get(ADMIN_EMAILS_CONFIG_TAG);
      if (rec) {
        if (rec.value !== adminNotificationEmails) {
          await pb.collection(COLLECTION_NAME).update(rec.id, { value: adminNotificationEmails });
          cmsRecords.set(ADMIN_EMAILS_CONFIG_TAG, rec);
        }
      } else {
        const created = await pb.collection(COLLECTION_NAME).create({
          tag: ADMIN_EMAILS_CONFIG_TAG,
          value: adminNotificationEmails,
          isfilenottext: false
        });
        cmsRecords.set(ADMIN_EMAILS_CONFIG_TAG, created);
      }
    }

    showToast("Opgeslagen!");
  } catch (err) {
    showToast("Opslaan mislukt: " + err.message);
  } finally {
    saveCooldownUntil = Date.now() + 1500;
    isSaving = false;
    if (saveBtn) saveBtn.innerText = "💾 Opslaan";
  }
}

function setupAdminUI() {
  let lock = document.createElement("button");
  lock.id = "cms-lock-btn";
  lock.innerHTML = "Bewerk";
  lock.title = "Beheer";
  lock.onclick = openPasswordModal;
  document.body.appendChild(lock);

  let bar = document.createElement("div");
  bar.id = "cms-floating-bar";
  bar.innerHTML = `
    <span>Bewerken actief</span>
    <button class="cms-primary" id="cmsSaveBtn">💾 Opslaan</button>
    <button id="cmsLogoutBtn">Uitloggen</button>
  `;
  document.body.appendChild(bar);

  document.getElementById("cmsSaveBtn").onclick = saveAllTextChanges;
  document.getElementById("cmsLogoutBtn").onclick = () => {
    pb.authStore.clear();
    location.reload();
  };
}

function openPasswordModal() {
  const modal = document.createElement("div");
  modal.className = "cms-modal-backdrop";
  modal.innerHTML = `
    <div class="cms-modal-box">
      <h3 style="margin-top:0; font-size:1.1rem;">Beheerderspaneel</h3>
      <input type="password" id="cmsPassInput" placeholder="Voer wachtwoord in..." autofocus>
      <div class="cms-modal-actions">
        <button id="cmsCancelModal" style="background:#eee; border:none; padding:8px 14px; border-radius:6px; cursor:pointer;">Annuleren</button>
        <button id="cmsSubmitModal" style="background:#2d3e2f; color:#fff; border:none; padding:8px 16px; border-radius:6px; cursor:pointer; font-weight:600;">Inloggen</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const input = modal.querySelector("#cmsPassInput");
  const cancelBtn = modal.querySelector("#cmsCancelModal");
  const submitBtn = modal.querySelector("#cmsSubmitModal");

  cancelBtn.onclick = () => modal.remove();

  const handleLogin = async () => {
    const password = input.value;
    if (!password) return;
    submitBtn.innerText = "Controleren...";
    try {
      await pb.collection("users").authWithPassword(ADMIN_EMAIL, password);
      modal.remove();
      activateEditMode();
      showToast("Ingelogd als beheerder");
    } catch (err) {
      showToast("Onjuist wachtwoord");
      submitBtn.innerText = "Inloggen";
    }
  };

  submitBtn.onclick = handleLogin;
  input.onkeydown = (e) => { if (e.key === "Enter") handleLogin(); };
}
function setupRealtimeSync() {
  pb.collection(COLLECTION_NAME).subscribe('*', async () => {
    if (isSaving || Date.now() < saveCooldownUntil) return;
    await loadCMSData();
  }).catch(() => {

    setTimeout(loadCMSData, 3000);
  });
}

const topbar = document.getElementById("topbar");
const hero = document.getElementById("hero");
const content = document.getElementById("content");
const buttons = document.querySelectorAll("button[data-target]");

buttons.forEach(button => {
  button.addEventListener("click", () => {
    const key = button.getAttribute("data-target");
    if (!views[key]) return;

    document.body.classList.remove("locked");
    content.classList.add("active");
    topbar.classList.add("visible");

    const existingCards = content.querySelectorAll(".card");

    const showNewView = () => {
      content.innerHTML = views[key];
      const newCards = content.querySelectorAll(".card");

      refreshGalleryDOM();
      renderFeaturesTrack();
      renderHouseRules();
      renderPricingTable();
      renderFAQ();
      applyCMSDataToDOM();
      if (isLoggedIn()) activateEditMode();

      newCards.forEach(card => card.classList.add("visible"));

      requestAnimationFrame(() => {
        const topbarHeight = topbar ? topbar.offsetHeight : 0;
        const rect = content.getBoundingClientRect();
        const targetY = window.pageYOffset + rect.top - topbarHeight - 10;
        renderAdminMessages();
        window.scrollTo({
          top: Math.max(0, targetY),
          behavior: "smooth"
        });
      });
    };

    if (existingCards.length > 0) {
      existingCards.forEach(card => {
        card.classList.remove("visible");
        card.classList.add("fading-out");
      });
      setTimeout(showNewView, 200);
    } else {
      showNewView();
    }
  });
});

document.addEventListener("DOMContentLoaded", async () => {
  document.body.classList.add("locked");
  setupAdminUI();
  await loadCMSData();
  setupRealtimeSync();
});

async function handleContactSubmit(e) {
  e.preventDefault();

  if (isLoggedIn()) {
    showToast("Verzending gepauzeerd: je bent ingelogd als beheerder.");
    return;
  }

  const submitBtn = document.getElementById("contactSubmitBtn");
  const naamInput = document.getElementById("contactNaam");
  const emailInput = document.getElementById("contactEmail");
  const berichtInput = document.getElementById("contactBericht");

  if (!naamInput || !emailInput || !berichtInput) return;

  const data = {
    naam: naamInput.value.trim(),
    email: emailInput.value.trim(),
    bericht: berichtInput.value.trim()
  };

  if (!data.naam || !data.email || !data.bericht) {
    showToast("Vul alle verplichte velden in.");
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = "Versturen...";
  }

  try {
    await pb.collection(MESSAGES_COLLECTION).create(data);

    naamInput.value = "";
    emailInput.value = "";
    berichtInput.value = "";

    showToast("Bedankt! Uw bericht is succesvol verzonden.");
  } catch (err) {
    console.error("Fout bij opslaan bericht:", err);
    const detail = err.data?.data ? JSON.stringify(err.data.data) : err.message;
    showToast("Versturen mislukt (400): " + detail);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      const rec = cmsRecords.get(73);
      submitBtn.innerText = (rec && rec.value) ? rec.value : "Versturen";
    }
  }
}

async function renderAdminMessages() {
  const container = document.getElementById("adminMessagesContainer");
  if (!container || !isLoggedIn()) {
    if (container) container.innerHTML = "";
    return;
  }

  container.innerHTML = `<p style="font-size:0.85rem; color:#666;">Beheerpanel laden...</p>`;

  try {
    const list = await pb.collection(MESSAGES_COLLECTION).getFullList({
      sort: "-created"
    });

    const itemsHTML = list.length === 0 
      ? `<p style="font-size: 0.85rem; color: #777; margin-top: 6px;">Er zijn nog geen contactberichten ontvangen.</p>`
      : list.map(msg => {
          const datum = new Date(msg.created).toLocaleDateString("nl-NL", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
          });

          return `
            <div class="admin-message-card" id="msg-${msg.id}">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 6px;">
                <div>
                  <strong>${msg.naam || "Onbekend"}</strong> 
                  <span style="font-size:0.8rem; color:#555;">(&lt;${msg.email}&gt;)</span>
                </div>
                <button class="cms-mini-btn danger" onclick="deleteMessage('${msg.id}')" title="Verwijderen">✕</button>
              </div>
              <div style="font-size:0.75rem; color:#888; margin-bottom: 6px;">${datum}</div>
              <p style="margin: 0; font-size:0.9rem; white-space:pre-wrap; background:#fff; padding:8px 10px; border-radius:4px; border:1px solid #e5ded3;">${msg.bericht}</p>
            </div>
          `;
        }).join("");

    container.innerHTML = `
      <div style="margin-top: 24px; padding-top: 14px; border-top: 2px dashed #2d3e2f;">
        <div style="background:#fbf9f5; border:1px solid #d8cebf; border-radius:6px; padding:12px; margin-bottom:16px;">
          <h4 style="margin:0 0 6px 0; font-size:0.95rem; color:#1f3323;">Notificatie E-mails voor Beheerders</h4>
          <p style="font-size:0.8rem; color:#666; margin:0 0 8px 0;">Vul één of meerdere e-mailadressen in (gescheiden door komma's):</p>
          <input type="text" id="adminEmailConfigInput" value="${adminNotificationEmails}" 
                 placeholder="bijv: ad@lapendery.nl, diny@lapendery.nl"
                 style="width:100%; padding:8px; border:1px solid #d8cebf; border-radius:4px; font-size:0.85rem; box-sizing:border-box;">
          <small style="font-size:0.75rem; color:#888; display:block; margin-top:4px;">Klik op '💾 Opslaan' in de zwevende balk om wijzigingen op te slaan.</small>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h4 style="margin:0; font-size:1rem; color:#1f3323;">Ingekomen Berichten (${list.length})</h4>
          <button class="cms-mini-btn" onclick="renderAdminMessages()">↻ Verversen</button>
        </div>
        <div style="display:flex; flex-direction:column; gap:10px; max-height:450px; overflow-y:auto; padding-right:4px;">
          ${itemsHTML}
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<p style="font-size:0.85rem; color:#dc2626;">Berichten ophalen mislukt: ${err.message}</p>`;
  }
}

async function deleteMessage(id) {
  showConfirmModal("Weet je zeker dat je dit bericht wilt verwijderen?", async () => {
    try {
      await pb.collection(MESSAGES_COLLECTION).delete(id);
      showToast("Bericht verwijderd");
      renderAdminMessages();
    } catch (err) {
      showToast("Fout bij verwijderen: " + err.message);
    }
  });
}