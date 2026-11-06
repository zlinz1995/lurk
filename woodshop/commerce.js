const workshopApi = 'https://api.lurk-app.com/woodworking';
form.addEventListener('input', () => { $('#estimate').hidden = true; });
function addSendButton(box) {
  const button = el('button','Send request to workshop','button');
  button.type = 'button';
  const feedback = el('p');
  feedback.setAttribute('role','status');
  button.onclick = async () => {
    if (!form.reportValidity()) return;
    button.disabled = true;
    feedback.textContent = 'Sending your request…';
    try {
      const data = new FormData(form);
      data.delete('photos');
      for (const file of form.elements.photos.files) data.append('photos',file);
      const response = await fetch(workshopApi+'/requests',{method:'POST',body:data});
      if (!response.ok || !(await response.json()).sent) throw new Error();
      feedback.textContent = 'Your request was sent to support@lurk-app.com. The workshop will reply by email.';
    } catch {
      button.disabled = false;
      feedback.textContent = 'Delivery could not be confirmed. Email support@lurk-app.com with your brief and reference photos.';
      const email = el('a','Open email draft');
      email.href = 'mailto:support@lurk-app.com?subject=Woodworking%20request&body='+encodeURIComponent(JSON.stringify(lastBrief,null,2));
      feedback.append(document.createTextNode(' '),email);
    }
  };
  box.append(button,feedback);
}
async function addCheckout(box, piece) {
  try {
    const response = await fetch(workshopApi+'/checkout/'+piece.id);
    if (!response.ok) return;
    const {url} = await response.json();
    if (new URL(url).origin !== 'https://buy.stripe.com' || !box.contains(document.querySelector('.detail-image')) || !box.textContent.includes(piece.name)) return;
    const link = el('a','Buy with secure checkout ↗','button');
    link.href = url;
    box.append(link);
  } catch { /* Visitors can still send a purchase inquiry. */ }
}
