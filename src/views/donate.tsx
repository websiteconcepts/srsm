import type { FC } from "hono/jsx";
import { raw } from "hono/html";
import { ORG } from "../donations";
import type { Donation, DonationTier } from "../types";
import { AdminPage } from "./admin";

export const DonateForm: FC<{
  tiers: DonationTier[];
  error?: string;
  values?: Record<string, string>;
}> = ({ tiers, error, values = {} }) => (
  <div class="donation_widget_wrapper mx-auto max-w-2xl">
    <header class="mb-8 text-center">
      <div aria-hidden="true" class="mb-3 flex items-center justify-center gap-3">
        <span class="h-px w-16 bg-saffron-600/30"></span>
        <span class="font-display text-saffron-700 text-2xl leading-none">॥</span>
        <span class="h-px w-16 bg-saffron-600/30"></span>
      </div>
      <h1 id="donation_title" class="font-display text-4xl md:text-5xl font-bold text-maroon-700">
        Donate
      </h1>
      <p id="donation_subtitle" class="mt-3 text-ink/60">
        Support {ORG.name} and the Sanatan Rashtra Shankhnad Mahotsav.
      </p>
    </header>

    {error && (
      <div class="mb-6 rounded-md border border-maroon-600/30 bg-maroon-600/10 px-4 py-3 text-sm text-maroon-700">
        {error}
      </div>
    )}

    <form
      method="post"
      action="/donate"
      id="donationForm"
      class="card space-y-6 p-6 md:p-8"
      autocomplete="off"
    >
      {/* Step 1 */}
      <div id="step1" class="space-y-5">
        <h2 class="font-display text-xl font-semibold text-maroon-700">
          1. Select your donation amount
        </h2>

        {tiers.length > 0 && (
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {tiers.map((t) => (
              <label
                class="donation-option group flex cursor-pointer items-center justify-between rounded-xl border-2 border-saffron-200 bg-white px-5 py-4 transition hover:border-saffron-500"
                data-value={`${t.amount}|${t.label}`}
              >
                <span>
                  <span class="block font-semibold text-ink">{t.label}</span>
                  <span class="text-sm text-ink/60">Tier</span>
                </span>
                <span class="font-display text-2xl font-semibold text-saffron-700">
                  ₹{t.amount.toLocaleString("en-IN")}
                </span>
              </label>
            ))}
          </div>
        )}

        <input type="hidden" name="amount_option" id="amountOptionInput" value={values.amount_option ?? ""} />

        <div>
          <label for="otherAmountInput" class="label">
            Or enter a custom amount{" "}
            <span class="text-ink/40">(minimum ₹101)</span>
          </label>
          <div class="relative">
            <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/60">
              ₹
            </span>
            <input
              type="number"
              min="101"
              step="1"
              id="otherAmountInput"
              name="other_amount"
              value={values.other_amount ?? ""}
              class="input pl-7"
              placeholder="0"
            />
          </div>
        </div>

        <div class="flex justify-end">
          <button type="button" id="nextStep" class="btn-primary px-8">
            Proceed →
          </button>
        </div>
      </div>

      {/* Step 2 */}
      <div id="step2" class="hidden space-y-5">
        <h2 class="font-display text-xl font-semibold text-maroon-700">
          2. Your details
        </h2>

        <div class="grid gap-4 sm:grid-cols-2">
          <div class="sm:col-span-2">
            <label for="d-name" class="label">Full name *</label>
            <input id="d-name" name="name" required class="input" value={values.name ?? ""} />
          </div>
          <div>
            <label for="d-email" class="label">Email *</label>
            <input id="d-email" type="email" name="email" required class="input" value={values.email ?? ""} />
          </div>
          <div>
            <label for="d-phone" class="label">Phone (10 digits) *</label>
            <div class="flex">
              <span class="inline-flex items-center rounded-l-md border border-r-0 border-saffron-200 bg-saffron-50 px-3 text-sm text-ink/70">
                +91
              </span>
              <input
                id="d-phone"
                type="tel"
                name="phone"
                required
                maxlength={10}
                pattern="[6-9][0-9]{9}"
                class="input rounded-l-none"
                value={values.phone ?? ""}
              />
            </div>
          </div>
          <div>
            <label for="d-pan" class="label">PAN number *</label>
            <input
              id="d-pan"
              name="pan_number"
              required
              maxlength={10}
              pattern="[A-Z]{5}[0-9]{4}[A-Z]{1}"
              class="input uppercase"
              value={values.pan_number ?? ""}
              placeholder="ABCDE1234F"
            />
            <p class="mt-1 text-xs text-ink/50">
              Required for an 80G receipt.
            </p>
          </div>
          <div class="sm:col-span-2">
            <label for="d-address" class="label">Full address *</label>
            <input id="d-address" name="address" required class="input" value={values.address ?? ""} />
          </div>
        </div>

        <div class="flex flex-wrap justify-between gap-3 pt-2">
          <button type="button" id="backStep" class="btn-ghost">
            ← Back
          </button>
          <button type="submit" class="btn-primary px-8">
            Donate now
          </button>
        </div>

        <p class="text-xs text-ink/50">
          You'll be redirected to Instamojo to complete payment securely.
        </p>
      </div>
    </form>

    <p id="donation_footnote" class="mt-6 text-center text-sm text-ink/50">
      Donations to {ORG.name} are eligible for 80G tax deduction · PAN {ORG.pan}
    </p>

    {raw(`<script>
(function(){
  const form = document.getElementById('donationForm');
  const options = document.querySelectorAll('.donation-option');
  const hiddenInput = document.getElementById('amountOptionInput');
  const customAmountInput = document.getElementById('otherAmountInput');
  const nextBtn = document.getElementById('nextStep');
  const backBtn = document.getElementById('backStep');
  const step1 = document.getElementById('step1');
  const step2 = document.getElementById('step2');

  function selectOption(el){
    options.forEach(o => {
      o.classList.remove('border-saffron-500','bg-saffron-50','ring-2','ring-saffron-300');
    });
    el.classList.add('border-saffron-500','bg-saffron-50','ring-2','ring-saffron-300');
    hiddenInput.value = el.dataset.value;
    customAmountInput.value = '';
  }

  options.forEach(o => o.addEventListener('click', () => selectOption(o)));

  customAmountInput.addEventListener('input', () => {
    options.forEach(o => o.classList.remove('border-saffron-500','bg-saffron-50','ring-2','ring-saffron-300'));
    hiddenInput.value = '';
  });

  nextBtn.addEventListener('click', () => {
    const customVal = customAmountInput.value.trim();
    if (!hiddenInput.value && (!customVal || parseFloat(customVal) < 101)) {
      alert('Please select or enter a valid amount (minimum ₹101).');
      return;
    }
    if (!hiddenInput.value && customVal) {
      hiddenInput.value = customVal + '|Custom Amount';
    }
    step1.classList.add('hidden');
    step2.classList.remove('hidden');
    window.scrollTo({ top: form.offsetTop - 80, behavior: 'smooth' });
  });

  backBtn.addEventListener('click', () => {
    step2.classList.add('hidden');
    step1.classList.remove('hidden');
  });

  form.addEventListener('submit', (e) => {
    const pan = (form.pan_number.value || '').trim().toUpperCase();
    form.pan_number.value = pan;
    const phone = (form.phone.value || '').trim();
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
      alert('Please enter a valid PAN (ABCDE1234F).');
      form.pan_number.focus();
      e.preventDefault();
      return;
    }
    if (!/^[6-9]\\d{9}$/.test(phone)) {
      alert('Please enter a valid 10-digit Indian mobile (starting 6/7/8/9).');
      form.phone.focus();
      e.preventDefault();
      return;
    }
  });
})();
</script>`)}
  </div>
);

export const RegisterAndDonatePage: FC<{
  tiers: DonationTier[];
  registerUrl: string;
}> = ({ tiers, registerUrl }) => (
  <div class="space-y-16">
    <header class="text-center">
      <div aria-hidden="true" class="mb-3 flex items-center justify-center gap-3">
        <span class="h-px w-16 bg-saffron-600/30"></span>
        <span class="font-display text-saffron-700 text-2xl leading-none">॥</span>
        <span class="h-px w-16 bg-saffron-600/30"></span>
      </div>
      <h1 class="font-display text-4xl md:text-5xl font-bold text-maroon-700">
        Connect &amp; Contribute
      </h1>
      <p class="mt-3 text-ink/60">
        Register to attend the Sanatan Rashtra Shankhnad Mahotsav, and support the cause with a contribution.
      </p>
    </header>

    <section>
      <h2 class="mb-4 font-display text-2xl md:text-3xl font-semibold text-maroon-700 text-center">
        Register for the Event
      </h2>
      <div class="card overflow-hidden p-2">
        <iframe
          src={registerUrl}
          title="Event registration"
          class="mx-auto block w-[350px] md:w-full h-[2200px] border-0"
          loading="lazy"
        />
      </div>
    </section>

    <div aria-hidden="true" class="flex items-center justify-center gap-3">
      <span class="h-px w-24 bg-saffron-600/30"></span>
      <span class="font-display text-saffron-700 text-2xl leading-none">॥</span>
      <span class="h-px w-24 bg-saffron-600/30"></span>
    </div>

    <section>
      <DonateForm tiers={tiers} />
    </section>
  </div>
);

export const DonateStatus: FC<{ ok: boolean; receipt?: string | null }> = ({ ok, receipt }) => (
  <div class="mx-auto max-w-xl text-center">
    {ok ? (
      <>
        <div class="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-saffron-100 text-3xl text-saffron-700">
          ॥
        </div>
        <h1 class="font-display text-4xl font-bold text-maroon-700">Dhanyavad!</h1>
        <p class="mt-4 text-lg text-ink/70">
          Your donation has been received. A receipt will be emailed to you shortly.
        </p>
        {receipt && (
          <p class="mt-2 text-sm text-ink/60">
            Receipt no: <strong>{receipt}</strong>
          </p>
        )}
        <div class="mt-8">
          <a href="/" class="btn-primary">Back to events</a>
        </div>
      </>
    ) : (
      <>
        <div class="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-maroon-600/10 text-3xl text-maroon-700">
          ✕
        </div>
        <h1 class="font-display text-4xl font-bold text-maroon-700">Payment not completed</h1>
        <p class="mt-4 text-lg text-ink/70">
          We couldn't confirm your payment. If money was deducted, it will be auto-refunded
          within 5–7 business days. You can also try again.
        </p>
        <div class="mt-8 flex justify-center gap-3">
          <a href="/donate" class="btn-primary">Try again</a>
          <a href="/" class="btn-ghost">Back home</a>
        </div>
      </>
    )}
  </div>
);

export const DonationTiersAdmin: FC<{
  tiers: DonationTier[];
  editing?: DonationTier;
  error?: string;
}> = ({ tiers, editing, error }) => (
  <AdminPage>
    <div class="mb-6 flex items-center justify-between">
      <h1 class="font-display text-3xl font-semibold text-maroon-700">Donation tiers</h1>
    </div>

    {error && (
      <div class="mb-6 rounded-md border border-maroon-600/30 bg-maroon-600/10 px-4 py-3 text-sm text-maroon-700">
        {error}
      </div>
    )}

    <p class="mb-6 text-sm text-ink/70">
      These appear as quick-pick buttons on the public <a href="/donate" class="underline">donate page</a>. Donors can always enter a custom amount regardless of how many tiers exist here.
    </p>

    {tiers.length === 0 ? (
      <div class="mb-6 rounded-xl border border-dashed border-saffron-300 p-6 text-center text-ink/60">
        No tiers yet — donors will only see the custom-amount field.
      </div>
    ) : (
      <div class="card mb-8 overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-saffron-50 text-left text-xs uppercase tracking-wider text-ink/60">
            <tr>
              <th class="px-4 py-3">Order</th>
              <th class="px-4 py-3">Label</th>
              <th class="px-4 py-3">Amount (₹)</th>
              <th class="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {tiers.map((t) => (
              <tr class="border-t border-saffron-100">
                <td class="px-4 py-3 text-ink/70">{t.sort_order}</td>
                <td class="px-4 py-3 font-medium">{t.label}</td>
                <td class="px-4 py-3 font-semibold text-maroon-700">
                  ₹{t.amount.toLocaleString("en-IN")}
                </td>
                <td class="px-4 py-3 text-right">
                  <a
                    href={`/admin/donation-tiers?edit=${t.id}`}
                    class="btn-ghost text-xs"
                  >
                    Edit
                  </a>
                  <form
                    method="post"
                    action={`/admin/donation-tiers/${t.id}/delete`}
                    class="inline"
                    onsubmit="return confirm('Delete this tier?')"
                  >
                    <button type="submit" class="btn-ghost text-xs text-maroon-700">
                      Delete
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}

    <h2 class="mb-3 font-display text-xl font-semibold text-maroon-700">
      {editing ? `Edit tier "${editing.label}"` : "Add a new tier"}
    </h2>
    <form
      method="post"
      action={editing ? `/admin/donation-tiers/${editing.id}` : "/admin/donation-tiers"}
      class="card grid gap-4 p-6 sm:grid-cols-3"
    >
      <div>
        <label class="label" for="t_label">Label</label>
        <input
          class="input"
          id="t_label"
          name="label"
          required
          value={editing?.label ?? ""}
          placeholder="e.g. Dharmasevak"
        />
      </div>
      <div>
        <label class="label" for="t_amount">Amount (₹)</label>
        <input
          class="input"
          id="t_amount"
          name="amount"
          type="number"
          min="1"
          step="1"
          required
          value={editing ? String(editing.amount) : ""}
          placeholder="5001"
        />
      </div>
      <div>
        <label class="label" for="t_order">Sort order</label>
        <input
          class="input"
          id="t_order"
          name="sort_order"
          type="number"
          step="1"
          value={editing ? String(editing.sort_order) : "10"}
          placeholder="10"
        />
        <p class="mt-1 text-xs text-ink/50">Lower numbers come first.</p>
      </div>
      <div class="sm:col-span-3 flex gap-3">
        <button type="submit" class="btn-primary">
          {editing ? "Save changes" : "Add tier"}
        </button>
        {editing && (
          <a href="/admin/donation-tiers" class="btn-ghost">
            Cancel
          </a>
        )}
      </div>
    </form>
  </AdminPage>
);

export const DonationsAdminList: FC<{
  total: { count: number; sum: number };
  flash?: { kind: "ok" | "err"; message: string };
}> = ({ total, flash }) => (
  <AdminPage>
    {/* DataTables assets */}
    <link
      rel="stylesheet"
      href="https://cdn.datatables.net/2.1.8/css/dataTables.dataTables.min.css"
    />
    {raw(`<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<script src="https://cdn.datatables.net/2.1.8/js/dataTables.min.js"></script>`)}

    <div class="mb-6 flex items-center justify-between gap-4">
      <h1 class="font-display text-3xl font-semibold text-maroon-700">Donations</h1>
      <a id="csv-export" href="/admin/donations.csv" class="btn-ghost">Export CSV</a>
    </div>

    {flash && (
      <div
        class={
          flash.kind === "ok"
            ? "mb-6 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
            : "mb-6 rounded-md border border-maroon-600/30 bg-maroon-600/10 px-4 py-3 text-sm text-maroon-700"
        }
      >
        {flash.message}
      </div>
    )}

    <div class="mb-6 grid gap-4 sm:grid-cols-2">
      <div class="card p-4">
        <p class="text-xs uppercase tracking-wider text-ink/50">Total paid donations</p>
        <p class="mt-1 font-display text-2xl font-semibold text-maroon-700">{total.count}</p>
      </div>
      <div class="card p-4">
        <p class="text-xs uppercase tracking-wider text-ink/50">Total amount (paid)</p>
        <p class="mt-1 font-display text-2xl font-semibold text-maroon-700">
          ₹{total.sum.toLocaleString("en-IN")}
        </p>
      </div>
    </div>

    <div class="card mb-4 flex flex-wrap items-end gap-3 p-4">
      <div>
        <label class="label" for="filter-from">From</label>
        <input class="input" type="date" id="filter-from" />
      </div>
      <div>
        <label class="label" for="filter-to">To</label>
        <input class="input" type="date" id="filter-to" />
      </div>
      <div>
        <label class="label" for="filter-status">Status</label>
        <select class="input" id="filter-status">
          <option value="">All</option>
          <option value="Credit">Paid</option>
          <option value="Pending">Pending</option>
          <option value="Failed">Failed</option>
        </select>
      </div>
      <button id="filter-clear" type="button" class="btn-ghost">Clear</button>
    </div>

    <div class="card overflow-x-auto p-4">
      <table id="donations-table" class="display w-full text-sm" style="width:100%">
        <thead>
          <tr>
            <th>Date</th>
            <th>Name / email</th>
            <th>Amount</th>
            <th>Purpose</th>
            <th>Status</th>
            <th>Receipt</th>
            <th>Actions</th>
          </tr>
        </thead>
      </table>
    </div>

    {raw(`<script>
$(function(){
  function currentFilters(){
    return {
      from:   $('#filter-from').val()   || '',
      to:     $('#filter-to').val()     || '',
      status: $('#filter-status').val() || '',
    };
  }

  const table = $('#donations-table').DataTable({
    serverSide: true,
    processing: true,
    pageLength: 25,
    lengthMenu: [10, 25, 50, 100, 250],
    order: [[0, 'desc']],
    ajax: {
      url: '/admin/donations.json',
      data: function(d){
        Object.assign(d, currentFilters());
      },
    },
    columns: [
      { data: 'date',       orderable: true,  searchable: false },
      { data: 'name_email', orderable: true,  searchable: true  },
      { data: 'amount',     orderable: true,  searchable: false, className: 'dt-right' },
      { data: 'purpose',    orderable: true,  searchable: true  },
      { data: 'status',     orderable: true,  searchable: true  },
      { data: 'receipt',    orderable: true,  searchable: true  },
      { data: 'actions',    orderable: false, searchable: false },
    ],
  });

  function reload(){ table.ajax.reload(); }
  $('#filter-from, #filter-to, #filter-status').on('change', reload);
  $('#filter-clear').on('click', function(){
    $('#filter-from').val('');
    $('#filter-to').val('');
    $('#filter-status').val('');
    table.search('');
    reload();
  });

  // Keep CSV export aligned to current filters + search.
  function syncCsvLink(){
    const f = currentFilters();
    const params = new URLSearchParams();
    if (f.from)   params.set('from',   f.from);
    if (f.to)     params.set('to',     f.to);
    if (f.status) params.set('status', f.status);
    const search = table.search();
    if (search)   params.set('search', search);
    const qs = params.toString();
    $('#csv-export').attr('href', '/admin/donations.csv' + (qs ? '?' + qs : ''));
  }
  table.on('draw', syncCsvLink);
  $('#filter-from, #filter-to, #filter-status').on('change', syncCsvLink);
});
</script>`)}
  </AdminPage>
);
