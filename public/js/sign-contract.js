function getToken() {
  return new URLSearchParams(window.location.search).get('token');
}

function toDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fillSignedInfo(contract) {
  const signedAtInfo = document.getElementById('signedAtInfo');
  const proofImage = document.getElementById('proofImage');
  signedAtInfo.textContent = contract.signedAt ? new Date(contract.signedAt).toLocaleString('pt-BR') : '-';
  if (contract.signerPhotoPath) {
    proofImage.src = contract.signerPhotoPath;
    proofImage.classList.remove('d-none');
  } else {
    proofImage.classList.add('d-none');
  }
}

async function loadContractToSign() {
  const token = getToken();
  if (!token) return;

  const response = await fetch(`/api/contracts/sign/${token}`);
  const contract = await response.json();
  if (!response.ok) return;

  document.getElementById('contractTitle').textContent = `Contrato ${contract.code} - ${contract.clientName}`;
  document.getElementById('signedBy').value = contract.signedBy || contract.clientName;

  const body = document.getElementById('contractBody');
  body.innerHTML = `
    <h6 id="dados">Dados do cliente</h6>
    <p><strong>Documento:</strong> ${contract.clientDocument}<br><strong>Email:</strong> ${contract.clientEmail}<br><strong>Telefone:</strong> ${contract.clientPhone}<br><strong>Valor:</strong> R$ ${Number(contract.contractValue).toLocaleString('pt-BR',{minimumFractionDigits:2})}</p>
    <h6 id="descricao">Descrição</h6>
    <p>${contract.descriptionText || 'Sem descrição informada.'}</p>
    <h6 id="clausulas">Cláusulas</h6>
    <ol>${(contract.clauses || []).map((c) => `<li>${c}</li>`).join('')}</ol>
    <p><em>Contrato emitido e assinado pela thynkXP Sistemas.</em></p>
  `;

  document.getElementById('contractNav').innerHTML = `
    <a class="list-group-item list-group-item-action" href="#dados">Dados do Cliente</a>
    <a class="list-group-item list-group-item-action" href="#descricao">Descrição</a>
    <a class="list-group-item list-group-item-action" href="#clausulas">Cláusulas</a>
  `;

  const signButton = document.getElementById('signButton');
  const quickButton = document.getElementById('quickSignButton');
  const feedback = document.getElementById('signFeedback');
  const photoInput = document.getElementById('signerPhoto');
  const photoPreview = document.getElementById('photoPreview');

  photoInput.addEventListener('change', async () => {
    const file = photoInput.files?.[0];
    if (!file) return;
    photoPreview.src = await toDataUrl(file);
    photoPreview.classList.remove('d-none');
  });

  fillSignedInfo(contract);
  if (contract.signed) {
    signButton.disabled = true;
    signButton.textContent = 'Já assinado';
    quickButton.disabled = true;
  }

  quickButton.addEventListener('click', () => signButton.click());

  signButton.addEventListener('click', async () => {
    const signedBy = document.getElementById('signedBy').value.trim() || contract.clientName;
    const file = photoInput.files?.[0];
    if (!file && !contract.signerPhotoPath) {
      feedback.className = 'alert alert-warning mt-2';
      feedback.textContent = 'Para concluir a assinatura digital, envie a foto do responsável.';
      feedback.classList.remove('d-none');
      return;
    }

    signButton.classList.add('signature-pulse');
    const photoDataUrl = file ? await toDataUrl(file) : undefined;

    const res = await fetch(`/api/contracts/sign/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signedBy, photoDataUrl }),
    });

    const payload = await res.json();
    signButton.classList.remove('signature-pulse');

    if (!res.ok) {
      feedback.className = 'alert alert-danger mt-2';
      feedback.textContent = payload.message || 'Erro ao assinar';
      feedback.classList.remove('d-none');
      return;
    }

    feedback.className = 'alert alert-success mt-2';
    feedback.textContent = `Contrato assinado com sucesso por ${payload.signedBy}.`;
    feedback.classList.remove('d-none');
    signButton.disabled = true;
    signButton.textContent = 'Já assinado';
    quickButton.disabled = true;
    fillSignedInfo(payload);
  });
}

document.addEventListener('DOMContentLoaded', loadContractToSign);
