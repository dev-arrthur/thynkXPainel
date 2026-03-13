function getToken() {
  const params = new URLSearchParams(window.location.search);
  return params.get('token');
}

async function loadContractToSign() {
  const token = getToken();
  if (!token) return;
  const response = await fetch(`/api/contracts/sign/${token}`);
  const contract = await response.json();
  if (!response.ok) return;

  document.getElementById('contractTitle').textContent = `Contrato ${contract.code} - ${contract.clientName}`;
  document.getElementById('contractBody').innerText = `Documento: ${contract.clientDocument}\nEmail: ${contract.clientEmail}\nTelefone: ${contract.clientPhone}\nValor: R$ ${Number(contract.contractValue).toLocaleString('pt-BR',{minimumFractionDigits:2})}\n\nDescrição:\n${contract.descriptionText || ''}\n\nCláusulas:\n- ${(contract.clauses || []).join('\n- ')}\n\nAssinado pela thynkXP Sistemas.`;

  const nav = document.getElementById('contractNav');
  nav.innerHTML = `<li>Dados do cliente</li><li>Descrição</li><li>Cláusulas</li><li>Assinatura</li>`;

  const signButton = document.getElementById('signButton');
  signButton.disabled = contract.signed;
  signButton.textContent = contract.signed ? 'Já assinado' : 'Assinar digitalmente';

  signButton.addEventListener('click', async () => {
    const signedBy = prompt('Confirme o nome do responsável para assinar:') || '';
    const r = await fetch(`/api/contracts/sign/${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ signedBy }) });
    const p = await r.json();
    const fb = document.getElementById('signFeedback');
    if (!r.ok) {
      fb.className = 'alert alert-danger mt-2'; fb.textContent = p.message || 'Erro ao assinar'; fb.classList.remove('d-none'); return;
    }
    fb.className = 'alert alert-success mt-2'; fb.textContent = `Contrato assinado com sucesso por ${p.signedBy}.`; fb.classList.remove('d-none');
    signButton.disabled = true; signButton.textContent = 'Já assinado';
  });
}

document.addEventListener('DOMContentLoaded', loadContractToSign);
