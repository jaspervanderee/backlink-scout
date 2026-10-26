// Site check page. All text from other websites is set with textContent, never as HTML.
const CONCURRENCY = 3;
const COPIED_FEEDBACK_MS = 1500;

const form = document.querySelector("#check-form");
const printInput = document.querySelector("#print-url");
const guideInput = document.querySelector("#guide-url");
const siteListInput = document.querySelector("#site-list");
const checkButton = document.querySelector("#check-button");
const errorBox = document.querySelector("#errors");
const results = document.querySelector("#results");

function element(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(options)) {
    if (key === "text") {
      node.textContent = value;
    } else if (key === "className") {
      node.className = value;
    } else if (value !== undefined && value !== null && value !== false) {
      node.setAttribute(key, value === true ? "" : value);
    }
  }
  for (const child of children.filter(Boolean)) {
    node.append(child);
  }
  return node;
}

function link(url, text) {
  return element("a", { href: url, target: "_blank", rel: "noreferrer", text: text ?? url });
}

function copyButton(readText, label = "Copy") {
  const button = element("button", { type: "button", className: "button small", text: label });
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(readText());
      button.textContent = "Copied";
      setTimeout(() => {
        button.textContent = label;
      }, COPIED_FEEDBACK_MS);
    } catch {
      button.textContent = "Copy failed";
    }
  });
  return button;
}

async function postJSON(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.json();
}

function showErrors(messages) {
  errorBox.hidden = messages.length === 0;
  errorBox.replaceChildren(...messages.map((message) => element("div", { text: message })));
}

function parseSiteList(text) {
  const sites = text.split(/[\s,]+/).map((site) => site.trim()).filter(Boolean);
  return [...new Set(sites)];
}

function describeContact(site) {
  return [site.tab, site.outreachDate, site.outcome || site.status].filter(Boolean).join(" · ");
}

function detailRows(rows) {
  const list = element("dl", { className: "rows" });
  for (const [label, content] of rows) {
    if (!content) {
      continue;
    }
    list.append(element("dt", { text: label }), element("dd", {}, [content]));
  }
  return list;
}

function textList(items) {
  return element("ul", {}, items.map((item) => element("li", { text: item })));
}

function buildMailtoLink(address, subject, body) {
  const query = new URLSearchParams({ subject, body }).toString().replace(/\+/g, "%20");
  return `mailto:${ address }?${ query }`;
}

function buildLoggedMessage(subject, body, fields) {
  const fieldLines = fields.map((field) => `${ field.label }: ${ field.value }`);
  const subjectLine = subject ? `Subject: ${ subject }` : "";
  return [subjectLine, body, ...fieldLines].filter(Boolean).join("\n\n");
}

function draftEditor(check, tabTitle, onLogged) {
  const { draft } = check;
  const isForm = draft.channel === "form";
  const wrapper = element("div", { className: "draft" }, [element("h3", { text: isForm ? "Form text" : "Email draft" })]);

  const subjectInput = element("input", { value: draft.subject });
  const messageInput = element("textarea", { className: "message" });
  messageInput.value = draft.body;

  if (!isForm && draft.to) {
    const openLink = element("a", { className: "button small", text: "Open in email" });
    const refreshLink = () => {
      openLink.href = buildMailtoLink(draft.to, subjectInput.value, messageInput.value);
    };
    refreshLink();
    subjectInput.addEventListener("input", refreshLink);
    messageInput.addEventListener("input", refreshLink);
    wrapper.append(element("div", { className: "draft-label" }, [element("span", { text: `To: ${ draft.to }` }), openLink]));
  }

  if (!isForm) {
    wrapper.append(
      element("div", { className: "draft-label" }, [element("span", { text: "Subject" }), copyButton(() => subjectInput.value)]),
      subjectInput,
    );
  }

  for (const field of draft.formFields) {
    wrapper.append(
      element("div", { className: "draft-label" }, [element("span", { text: field.label }), copyButton(() => field.value)]),
      element("div", { text: field.value }),
    );
  }

  wrapper.append(
    element("div", { className: "draft-label" }, [element("span", { text: "Message" }), copyButton(() => messageInput.value)]),
    messageInput,
  );

  const logButton = element("button", {
    type: "button",
    className: "button primary",
    text: tabTitle ? `Mark as sent → ${ tabTitle }` : "Mark as sent (no sheet tab)",
    disabled: !tabTitle,
  });
  const logError = element("div", { className: "alert error", hidden: true });

  logButton.addEventListener("click", async () => {
    logButton.disabled = true;
    logError.hidden = true;
    const date = new Date().toISOString().slice(0, 10);
    const result = await postJSON("/api/log-pitch", {
      tabTitle,
      name: draft.siteName || check.domain,
      website: check.domain,
      email: draft.to ?? (isForm ? "form" : ""),
      message: buildLoggedMessage(subjectInput.value, messageInput.value, draft.formFields),
      date,
    });

    if (!result.ok) {
      logButton.disabled = false;
      logError.textContent = result.message;
      logError.hidden = false;
      return;
    }

    logButton.textContent = `Logged in ${ tabTitle }`;
    onLogged({ domain: check.domain, tab: tabTitle, name: draft.siteName, outreachDate: date, status: "sent", outcome: "" });
  });

  wrapper.append(logError, logButton);
  return wrapper;
}

function verdictDetails(check) {
  const { evidence, summary } = check;
  const latest = evidence.latestPostAt ? evidence.latestPostAt.slice(0, 10) : "unknown";
  const outsideWork = summary.featuresOutsideWorkNote
    ? `${ summary.featuresOutsideWork }: ${ summary.featuresOutsideWorkNote }`
    : summary.featuresOutsideWork;
  const publishes = summary.contentFormat ? `${ summary.topics } (${ summary.contentFormat })` : summary.topics;

  return element("details", {}, [
    element("summary", { text: "Why this verdict" }),
    detailRows([
      ["What they publish", publishes],
      ["Outside work", outsideWork],
      ["Active", `Latest post ${ latest } · ${ evidence.postsLast90Days } posts in the last 90 days`],
      ["Fit", summary.fitNote],
      ["Angle", summary.angle],
      ["Rules", summary.submission.rules.length > 0 ? textList(summary.submission.rules) : null],
      ["Notes", evidence.notes.join(" ")],
    ]),
  ]);
}

function siteCard(check, contacted, tabTitle) {
  const { evidence, summary, draft } = check;
  const card = element("article", { className: "card" });
  const lean = summary ? summary.lean : "no summary";

  card.append(element("div", { className: "card-header" }, [
    link(`https://${ check.domain }`, check.domain),
    element("span", { className: `badge ${ lean }`, text: lean }),
  ]));

  const contactNote = element("div", { className: "alert info", hidden: contacted.length === 0 });
  const renderContacts = () => {
    contactNote.replaceChildren(
      element("div", { text: "Already in your sheet:" }),
      ...contacted.map((site) => element("div", { text: describeContact(site) })),
    );
    contactNote.hidden = contacted.length === 0;
  };
  renderContacts();
  card.append(contactNote);

  if (check.error) {
    card.append(element("div", { className: "alert error", text: check.error }));
  }

  if (summary) {
    const submission = summary.submission;
    const submissionPageURL = evidence.submissionPage?.url ?? evidence.routes[0]?.url ?? null;
    const howToSubmit = element("span", { text: submission.method || "unknown" });
    if (draft?.to) {
      howToSubmit.append(" ", element("a", { href: `mailto:${ draft.to }`, text: draft.to }));
    }

    card.append(detailRows([
      ["How to submit", howToSubmit],
      ["Submission page", submissionPageURL ? link(submissionPageURL) : null],
      ["What to send", submission.materials.length > 0 ? textList(submission.materials) : null],
    ]));
  }

  if (draft) {
    card.append(draftEditor(check, tabTitle, (site) => {
      contacted.push(site);
      renderContacts();
    }));
  }

  if (summary) {
    card.append(verdictDetails(check));
  }

  return card;
}

async function handleSubmit(event) {
  event.preventDefault();
  const sites = parseSiteList(siteListInput.value);
  if (sites.length === 0) {
    return;
  }

  const errors = [];
  let completed = 0;
  const updateButton = () => {
    checkButton.textContent = `Checking ${ completed } of ${ sites.length }…`;
  };

  checkButton.disabled = true;
  updateButton();
  results.replaceChildren();
  showErrors([]);

  const printURL = printInput.value.trim();
  const sheetQuery = new URLSearchParams({ print: printURL }).toString();
  const [contextResult, sheet] = await Promise.all([
    postJSON("/api/project-context", { urls: [guideInput.value.trim(), printURL] }),
    fetch(`/api/sheet?${ sheetQuery }`).then((response) => response.json()),
  ]);

  if (!sheet.ok) {
    errors.push(`Outreach sheet: ${ sheet.message }`);
    showErrors(errors);
  }
  const contactedSites = sheet.ok ? sheet.contactedSites : [];
  const tabTitle = sheet.tabTitle ?? "";

  let nextIndex = 0;
  async function worker() {
    while (nextIndex < sites.length) {
      const site = sites[nextIndex];
      nextIndex += 1;

      try {
        const result = await postJSON("/api/check-site", { domain: site, projectContext: contextResult.context });
        if (result.ok) {
          const contacted = contactedSites.filter((entry) => entry.domain === result.check.domain);
          results.append(siteCard(result.check, contacted, tabTitle));
        } else {
          errors.push(`${ site }: ${ result.message }`);
        }
      } catch {
        errors.push(`${ site }: the check failed unexpectedly.`);
      }

      completed += 1;
      updateButton();
      showErrors(errors);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  checkButton.disabled = false;
  checkButton.textContent = "Check sites";
}

form.addEventListener("submit", handleSubmit);
