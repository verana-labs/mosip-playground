"use client";

import { useState } from "react";
import { IdCard, Sparkles, Clock } from "lucide-react";

// The seeded residents the Inji Certify CSV registry can issue for.
const RESIDENTS = [
  { id: "7841223190", name: "Asha Devi Sharma", dob: "1992-03-14" },
  { id: "3320114588", name: "Ravi Kumar Patel", dob: "1988-11-02" },
];

export default function IssueButton() {
  const [resident, setResident] = useState(RESIDENTS[0].id);
  const [clicked, setClicked] = useState(false);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <IdCard className="w-4 h-4 text-violet-500" />
        <span className="font-semibold text-gray-900 text-sm">Issue a Foundational Resident ID</span>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <label className="flex-1 text-sm">
          <span className="block text-gray-500 mb-1">Resident</span>
          <select
            value={resident}
            onChange={(e) => setResident(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-800 focus:border-violet-400 focus:outline-none"
          >
            {RESIDENTS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} · {r.id}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={() => setClicked(true)}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
        >
          <Sparkles className="w-4 h-4" /> Issue credential
        </button>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
        <Clock className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          {clicked ? (
            <>
              Live issuance is being wired next. The page will run the real eSignet authorization-code flow
              against Inji Certify and show the signed credential here.
            </>
          ) : (
            <>
              Coming next: this runs the real OID4VCI issuance through eSignet and Inji Certify, then shows the
              signed Verifiable Credential, no more issuing by hand.
            </>
          )}
        </span>
      </div>
    </div>
  );
}
