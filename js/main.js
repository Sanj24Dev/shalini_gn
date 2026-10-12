/* Renders the page from the data files in /data.
   To add, remove or reorder sections, edit the SECTIONS list at the bottom. */
(async function() {
    let P;

    // ---------- load content from /content/*.csv ----------
    // Time-based files are stored oldest first, so the LAST row is the newest.
    // They are reversed here so new rows appear at the top of the page.
    function parseCSV(text) {
        text = text.replace(/^\uFEFF/, '');
        const rows = [];
        let row = [],
            cell = '',
            q = false;
        for (let i = 0; i < text.length; i++) {
            const c = text[i];
            if (q) {
                if (c === '"') {
                    if (text[i + 1] === '"') {
                        cell += '"';
                        i++;
                    } else q = false;
                } else cell += c;
            } else if (c === '"') q = true;
            else if (c === ',') {
                row.push(cell);
                cell = '';
            } else if (c === '\n' || c === '\r') {
                if (c === '\r' && text[i + 1] === '\n') i++;
                row.push(cell);
                cell = '';
                rows.push(row);
                row = [];
            } else cell += c;
        }
        if (cell !== '' || row.length) {
            row.push(cell);
            rows.push(row);
        }
        const head = (rows.shift() || []).map(x => x.trim());
        return rows.filter(r => r.some(x => x.trim() !== ''))
            .map(r => Object.fromEntries(head.map((k, i) => [k, (r[i] || '').trim()])));
    }
    async function csv(name) {
        const r = await fetch('content/' + name + '.csv', { cache: 'no-store' });
        if (!r.ok) throw new Error(name + '.csv not found');
        return parseCSV(new TextDecoder('utf-8').decode(await r.arrayBuffer()));
    }
    const rev = a => a.slice().reverse();

    async function loadContent() {
        const names = ['profile', 'links', 'stats', 'research_areas', 'skills', 'education', 'experience', 'grants',
            'research_roles', 'editorial', 'copyrights', 'publications', 'presentations', 'sessions', 'awards', 'events', 'guided'
        ];
        const d = Object.fromEntries(await Promise.all(names.map(async n => [n, await csv(n)])));
        const kv = Object.fromEntries(d.profile.map(r => [r.field, r.value]));
        const skillGroups = [];
        d.skills.forEach(r => {
            let g = skillGroups.find(x => x.group === r.group);
            if (!g) skillGroups.push(g = { group: r.group, items: [] });
            g.items.push(r.skill);
        });
        P = {
            name: kv.name,
            credentials: kv.credentials,
            title: kv.title,
            affiliation: kv.affiliation,
            location: kv.location,
            about: kv.about,
            lastUpdated: kv.last_updated,
            links: d.links.map(r => ({ label: r.label, href: r.url, text: r.text })),
            stats: d.stats,
            researchAreas: d.research_areas.map(r => r.area),
            skills: skillGroups,
            education: rev(d.education).map(r => ({ degree: r.degree, institution: r.institution, years: r.years, note: r.note })),
            experience: rev(d.experience).map(r => ({ role: r.role, org: r.organization, dates: r.dates, kind: r.type })),
            grants: rev(d.grants),
            researchRoles: rev(d.research_roles).map(r => r.text),
            editorial: rev(d.editorial).map(r => r.text),
            copyrights: rev(d.copyrights).map(r => r.text)
        };
        window.PUBLICATIONS = rev(d.publications).map(r => ({ citation: r.citation, year: r.year, doi: r.doi, group: r.type }));
        window.PRESENTATIONS = rev(d.presentations);
        window.SESSIONS = rev(d.sessions);
        window.AWARDS = rev(d.awards);
        window.EVENTS = rev(d.events);
        window.GUIDED = rev(d.guided);
    }

    try { await loadContent(); } catch (err) {
        const local = location.protocol === 'file:';
        document.getElementById('sections').append(h('div', { class: 'card' },
            h('strong', { text: 'The content could not be loaded.' }),
            h('p', {
                class: 'sub',
                text: local ?
                    'This page reads its content from the files in the "content" folder, which browsers block when index.html is opened directly from disk. Use preview.bat (Windows) or preview.command (Mac), or upload the folder to a web host.' : 'Check that the "content" folder is uploaded next to index.html. (' + err.message + ')'
            })));
        return;
    }

    // ---------- helpers ----------
    function h(tag, attrs, ...kids) {
        const e = document.createElement(tag);
        for (const [k, v] of Object.entries(attrs || {})) {
            if (k === 'class') e.className = v;
            else if (k === 'text') e.textContent = v;
            else if (v !== false && v != null) e.setAttribute(k, v);
        }
        kids.flat().forEach(c => c != null && e.append(c.nodeType ? c : document.createTextNode(c)));
        return e;
    }
    const ul = (items, cls = 'plain') => h('ul', { class: cls }, items.map(t => h('li', { text: t })));
    const block = (id, title, ...kids) => h('section', { class: 'block', id }, h('h2', { text: title }), ...kids);

    // ---------- hero ----------
    function renderHero() {
        const stats = P.stats.map(s => {
            const v = s.value === 'auto:publications' ?
                (window.PUBLICATIONS || []).length :
                s.value;
            return h('div', { class: 'stat' }, h('b', { text: String(v) }), h('span', { text: s.label }));
        });
        const initials = P.name.replace(/^Dr\.?\s*/i, '').split(/\s+/).map(w => w[0]).slice(0, 2).join('');
        document.getElementById('hero').append(
            h('div', { class: 'avatar', 'aria-hidden': 'true', text: initials }),
            h('h1', { text: P.name }),
            h('p', { class: 'cred', text: P.credentials }),
            h('p', { class: 'role', text: P.title }),
            h('p', { class: 'aff', text: P.affiliation + ', ' + P.location }),
            h('p', { class: 'about', text: P.about }),
            h('ul', { class: 'links' }, P.links.map(l =>
                h('li', {}, h('a', { href: l.href, rel: 'noopener', target: l.href.startsWith('http') ? '_blank' : false, text: l.label + ': ' + l.text })))),
            h('div', { class: 'stats' }, stats)
        );
        document.getElementById('brand').textContent = P.name;
        document.title = P.name + ' | ' + P.title;
    }

    // ---------- sections ----------
    function research() {
        const guided = window.GUIDED || [];
        const levels = [...new Set(guided.map(g => g.level))];
        return block('research', 'Research',
            h('p', {}, P.researchAreas.map(a => h('span', { class: 'tag', text: a }))),
            h('h3', { text: 'Funded research (Co-Investigator)' }),
            P.grants.map(g => h('div', { class: 'card' },
                h('div', { class: 'row' }, h('strong', { text: g.title }), h('span', { class: 'when', text: g.status })),
                h('p', { class: 'sub', text: g.agency + ' | ' + g.amount + ' | ' + g.role }))),
            h('div', { class: 'two' },
                h('div', {}, h('h3', { text: 'Research roles' }), ul(P.researchRoles)),
                h('div', {}, h('h3', { text: 'Editorial and peer review' }), ul(P.editorial))),
            h('h3', { text: 'Copyrights' }), ul(P.copyrights),
            h('h3', { text: 'Research guidance (' + guided.length + ')' }),
            levels.map(l => h('details', {},
                h('summary', { text: l + ' (' + guided.filter(g => g.level === l).length + ')' }),
                h('ul', { class: 'clean' }, guided.filter(g => g.level === l).map(g =>
                    h('li', { class: 'item' }, g.title,
                        (g.student || g.year) ? h('div', { class: 'meta', text: [g.student, g.year].filter(Boolean).join(' | ') }) : null)))))
        );
    }

    function publications() {
        const all = window.PUBLICATIONS || [];
        const pres = window.PRESENTATIONS || [];
        const PAGE = 15;
        let shown = PAGE;
        const q = h('input', { type: 'search', placeholder: 'Search title, author or journal', 'aria-label': 'Search publications' });
        const yr = h('select', { 'aria-label': 'Filter by year' }, h('option', { value: '', text: 'All years' }), [...new Set(all.map(p => p.year))].sort((a, b) => b - a).map(y => h('option', { value: y, text: y })));
        const grp = h('select', { 'aria-label': 'Filter by type' }, h('option', { value: '', text: 'All types' }), [...new Set(all.map(p => p.group))].map(g => h('option', { value: g, text: g })));
        const count = h('p', { class: 'count' });
        const list = h('ul', { class: 'clean card' });
        const more = h('button', { class: 'more', type: 'button', text: 'Show more' });

        function draw() {
            const t = q.value.trim().toLowerCase();
            const f = all.filter(p => (!yr.value || String(p.year) === yr.value) && (!grp.value || p.group === grp.value) && (!t || p.citation.toLowerCase().includes(t)));
            count.textContent = f.length + ' of ' + all.length + ' publications';
            list.replaceChildren(...f.slice(0, shown).map(p => h('li', { class: 'item' }, p.citation,
                p.doi ? h('div', { class: 'meta' }, h('a', { href: 'https://doi.org/' + p.doi, target: '_blank', rel: 'noopener', text: 'doi.org/' + p.doi })) : null)));
            more.style.display = f.length > shown ? '' : 'none';
        }
        [q, yr, grp].forEach(c => c.addEventListener('input', () => {
            shown = PAGE;
            draw();
        }));
        more.addEventListener('click', () => {
            shown += PAGE;
            draw();
        });
        draw();

        return block('publications', 'Publications and Presentations',
            h('div', { class: 'controls' }, q, yr, grp), count, list, more,
            h('h3', { text: 'Scientific presentations (' + pres.length + ')' }),
            h('details', {}, h('summary', { text: 'Show all presentations' }),
                h('ul', { class: 'clean' }, pres.map(p => h('li', { class: 'item' }, h('span', { class: 'tag', text: p.type }), p.text)))));
    }

    function experience() {
        return block('experience', 'Experience',
            P.experience.map(e => h('div', { class: 'card' },
                h('div', { class: 'row' }, h('strong', { text: e.role }), h('span', { class: 'when', text: e.dates })),
                h('p', { class: 'sub', text: e.org }), h('span', { class: 'tag', text: e.kind }))));
    }

    function education() {
        return block('education', 'Education',
            P.education.map(e => h('div', { class: 'card' },
                h('div', { class: 'row' }, h('strong', { text: e.degree }), h('span', { class: 'when', text: e.years })),
                h('p', { class: 'sub', text: e.institution + (e.note ? ' | ' + e.note : '') }))));
    }

    function teaching() {
        const s = window.SESSIONS || [],
            ev = window.EVENTS || [];
        return block('teaching', 'Teaching',
            h('h3', { text: 'Workshops and conferences organized (' + ev.length + ')' }),
            ev.map(e => h('div', { class: 'card' }, h('strong', { text: e.role }), h('p', { class: 'sub', text: e.programme }))),
            h('h3', { text: 'Resource person for scientific sessions (' + s.length + ')' }),
            h('details', {}, h('summary', { text: 'Show all sessions' }),
                h('ul', { class: 'clean' }, s.map(x => h('li', { class: 'item' }, x.text)))));
    }

    function awards() {
        const a = window.AWARDS || [];
        return block('awards', 'Awards and Recognition',
            h('ul', { class: 'clean card' }, a.map(x => h('li', { class: 'item' }, x.text))));
    }

    function skills() {
        return block('skills', 'Skills',
            P.skills.map(g => h('div', { class: 'card' }, h('strong', { text: g.group }),
                h('p', {}, g.items.map(i => h('span', { class: 'tag', text: i }))))));
    }

    // ---------- section list: edit order / labels here ----------
    const SECTIONS = [
        { id: 'research', nav: 'Research', render: research },
        { id: 'publications', nav: 'Publications', render: publications },
        { id: 'experience', nav: 'Experience', render: experience },
        { id: 'education', nav: 'Education', render: education },
        { id: 'teaching', nav: 'Teaching', render: teaching },
        { id: 'awards', nav: 'Awards', render: awards },
        { id: 'skills', nav: 'Skills', render: skills }
    ];

    // ---------- boot ----------
    renderHero();
    const host = document.getElementById('sections'),
        nav = document.getElementById('nav');
    SECTIONS.forEach(s => {
        host.append(s.render());
        nav.append(h('a', { href: '#' + s.id, text: s.nav }));
    });
    document.getElementById('footer').textContent = 'Last updated ' + P.lastUpdated;

    const btn = document.getElementById('menuBtn');
    btn.addEventListener('click', () => {
        const o = nav.classList.toggle('open');
        btn.setAttribute('aria-expanded', o);
    });
    nav.addEventListener('click', () => {
        nav.classList.remove('open');
        btn.setAttribute('aria-expanded', false);
    });

    // highlight current section in nav
    const links = [...nav.querySelectorAll('a')];
    const obs = new IntersectionObserver(es => es.forEach(e => {
        if (e.isIntersecting) links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
    }), { rootMargin: '-40% 0px -55% 0px' });
    SECTIONS.forEach(s => obs.observe(document.getElementById(s.id)));
})();