(function () {
  function ensureModal() {
    let modal = document.getElementById('professionalConfirmModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'professionalConfirmModal';
    modal.className = 'fixed inset-0 z-[9999] hidden items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4';
    modal.innerHTML = `
      <div class="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl shadow-black/50">
        <div class="flex items-start gap-4 border-b border-slate-800 px-6 py-5">
          <div id="professionalConfirmIcon" class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-500/10 text-xl">⚠</div>
          <div>
            <p class="text-[10px] font-black uppercase tracking-[0.24em] text-amber-400">Confirmation Required</p>
            <h3 id="professionalConfirmTitle" class="mt-1 text-lg font-black text-white">Please confirm</h3>
          </div>
        </div>
        <div class="px-6 py-5">
          <p id="professionalConfirmMessage" class="text-sm leading-6 text-slate-300"></p>
        </div>
        <div class="flex justify-end gap-3 border-t border-slate-800 px-6 py-4">
          <button id="professionalConfirmCancel" type="button" class="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-slate-300 transition hover:border-slate-600 hover:bg-slate-800">Cancel</button>
          <button id="professionalConfirmAccept" type="button" class="rounded-xl border border-emerald-500/30 bg-emerald-600 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white transition hover:bg-emerald-500">Confirm</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    return modal;
  }

  window.openProfessionalConfirm = function (message, title) {
    const modal = ensureModal();
    document.getElementById('professionalConfirmTitle').textContent = title || 'Please confirm';
    document.getElementById('professionalConfirmMessage').textContent = message;
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    return new Promise((resolve) => {
      const cancelButton = document.getElementById('professionalConfirmCancel');
      const acceptButton = document.getElementById('professionalConfirmAccept');

      const cleanup = (result) => {
        cancelButton.onclick = null;
        acceptButton.onclick = null;
        modal.onclick = null;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        resolve(result);
      };

      cancelButton.onclick = () => cleanup(false);
      acceptButton.onclick = () => cleanup(true);
      modal.onclick = (event) => {
        if (event.target === modal) cleanup(false);
      };

      acceptButton.focus();
    });
  };

  window.confirm = function (message) {
    return window.openProfessionalConfirm(message, 'Please confirm');
  };

  window.alert = function (message) {
    const existing = document.getElementById('professionalAlertToast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'professionalAlertToast';
    toast.className = 'fixed left-1/2 top-6 z-[10000] -translate-x-1/2 rounded-xl border border-sky-500/30 bg-slate-950 px-5 py-4 text-sm font-bold text-slate-200 shadow-2xl shadow-black/50';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  };
})();
