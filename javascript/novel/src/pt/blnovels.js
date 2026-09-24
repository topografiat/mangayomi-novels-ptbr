const mangayomiSources = [{
    "name": "BL Novels",
    "lang": "pt",
    "baseUrl": "https://blnovels.com",
    "apiUrl": "",
    "iconUrl": "https://blnovels.com/favicon.ico",
    "typeSource": "single",
    "itemType": 2,
    "version": "0.1.0",
    "pkgPath": "novel/src/pt/blnovels.js",
    "notes": "Novels em português do BL Novels."
}];

class DefaultExtension extends MProvider {

    getHeaders(url) {
        return {
            "User-Agent": "Mozilla/5.0 (Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36",
            "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
            "Referer": this.source.baseUrl + "/"
        };
    }

    absoluteUrl(href) {
        if (!href) return "";

        if (href.startsWith("http://") ||
            href.startsWith("https://")) {
            return href;
        }

        if (href.startsWith("//")) {
            return "https:" + href;
        }

        if (href.startsWith("/")) {
            return this.source.baseUrl + href;
        }

        return this.source.baseUrl + "/" + href;
    }

    async fetch(url) {
        const res = await new Client().get(
            url,
            this.getHeaders(url)
        );

        if (res.statusCode !== 200) {
            throw new Error(
                "BL Novels retornou HTTP " + res.statusCode
            );
        }

        return new Document(res.body);
    }

    cleanText(text) {
        return (text || "")
            .replace(/\s+/g, " ")
            .trim();
    }

    imageUrl(element) {
        if (!element) return "";

        const img = element.selectFirst("img");

        if (!img) return "";

        return this.absoluteUrl(
            img.attr("data-src") ||
            img.attr("data-lazy-src") ||
            img.attr("data-original") ||
            img.attr("src") ||
            ""
        );
    }

    isNovelUrl(link) {
        return link.includes("/novel/") &&
            !link.includes("/capitulo-") &&
            !link.includes("/tag/") &&
            !link.includes("/category/");
    }

    async getNovelList(page) {
        const n = page || 1;

        const url = n === 1
            ? this.source.baseUrl + "/"
            : this.source.baseUrl + "/page/" + n + "/";

        const doc = await this.fetch(url);

        const list = [];
        const seen = {};

        for (const a of doc.select("a")) {

            const href = a.attr("href") || "";
            const link = this.absoluteUrl(href);
            const name = this.cleanText(a.text || "");

            if (!name) continue;
            if (!this.isNovelUrl(link)) continue;
            if (seen[link]) continue;

            if (
                /^cap[ií]tulo\b/i.test(name) ||
                /^extra\b/i.test(name)
            ) {
                continue;
            }

            seen[link] = true;

            list.push({
                name: name,
                link: link,
                imageUrl: this.imageUrl(a)
            });
        }

        let hasNextPage = false;

        for (const a of doc.select("a")) {

            const href = a.attr("href") || "";
            const text = this.cleanText(
                a.text || ""
            ).toLowerCase();

            if (
                href.includes("/page/" + (n + 1) + "/") ||
                text.includes("próxima") ||
                text.includes("posts mais antigos")
            ) {
                hasNextPage = true;
                break;
            }
        }

        return {
            list: list,
            hasNextPage: hasNextPage
        };
    }

    async getPopular(page) {
        return await this.getNovelList(page);
    }

    get supportsLatest() {
        return true;
    }

    async getLatestUpdates(page) {
        return await this.getNovelList(page);
    }

    async search(query, page, filters) {

        const n = page || 1;

        let url =
            this.source.baseUrl +
            "/?s=" +
            encodeURIComponent(query);

        if (n > 1) {
            url += "&paged=" + n;
        }

        const doc = await this.fetch(url);

        const list = [];
        const seen = {};

        for (const a of doc.select("a")) {

            const href = a.attr("href") || "";
            const link = this.absoluteUrl(href);
            const name = this.cleanText(a.text || "");

            if (!name) continue;
            if (!this.isNovelUrl(link)) continue;
            if (seen[link]) continue;

            seen[link] = true;

            list.push({
                name: name,
                link: link,
                imageUrl: this.imageUrl(a)
            });
        }

        return {
            list: list,
            hasNextPage: false
        };
    }

    async getDetail(url) {

        const doc = await this.fetch(url);

        let name = "";

        const h1 = doc.selectFirst("h1");

        if (h1) {
            name = this.cleanText(h1.text);
        }

        if (!name) {
            name = url;
        }

        let description = "";

        for (const selector of [
            ".summary_content",
            ".summary",
            ".description",
            ".entry-content",
            "article"
        ]) {

            const el = doc.selectFirst(selector);

            if (!el) continue;

            const txt = this.cleanText(
                el.text || ""
            );

            if (txt.length > 40) {
                description = txt;
                break;
            }
        }

        let author = "";

        for (const selector of [
            ".author-content",
            ".author",
            ".summary_content .author"
        ]) {

            const el = doc.selectFirst(selector);

            if (el) {
                author = this.cleanText(
                    el.text || ""
                );

                if (author) break;
            }
        }

        const chapters = [];
        const seen = {};

        /*
         * Os capítulos do BL Novels ficam
         * dentro da própria página da novel.
         */

        for (const a of doc.select("a")) {

            const href = a.attr("href") || "";
            const link = this.absoluteUrl(href);
            const text = this.cleanText(a.text || "");

            if (!link) continue;

            if (!link.includes("/novel/")) {
                continue;
            }

            if (link === url) {
                continue;
            }

            if (seen[link]) {
                continue;
            }

            /*
             * Identifica capítulos, prólogo,
             * extras e outros conteúdos de leitura.
             */

            if (
                !/cap[ií]tulo|extra|pr[oó]logo|sinopse|aviso|in[ií]cio|gloss[aá]rio|personagens/i.test(text)
            ) {
                continue;
            }

            /*
             * Não adiciona links que sejam
             * páginas da própria novel.
             */

            if (
                link.endsWith("/novel/") ||
                link === url
            ) {
                continue;
            }

            seen[link] = true;

            chapters.push({
                name: text,
                url: link,
                scanlator: "BL Novels"
            });
        }

        /*
         * O site apresenta os capítulos
         * do mais recente para o mais antigo.
         * Invertemos para leitura normal.
         */

        chapters.reverse();

        return {
            name: name,
            link: url,
            imageUrl: this.imageUrl(doc),
            description: description,
            author: author,
            genre: [
                "Novel",
                "BL",
                "PT-BR"
            ],
            status: 1,
            chapters: chapters
        };
    }

    async getHtmlContent(name, url) {

        const doc = await this.fetch(url);

        /*
         * No BL Novels o texto do capítulo
         * aparece diretamente na página.
         */

        for (const selector of [
            ".reading-content",
            ".chapter-content",
            ".entry-content",
            ".post-content",
            "article .content",
            "article"
        ]) {

            const content = doc.selectFirst(selector);

            if (!content) continue;

            const text = (
                content.text || ""
            ).trim();

            if (text.length > 100) {
                return content.outerHtml;
            }
        }

        /*
         * Fallback para páginas em que
         * o conteúdo esteja dentro do body.
         */

        const body = doc.selectFirst("body");

        if (body) {

            const text = (
                body.text || ""
            ).trim();

            if (text.length > 100) {
                return body.outerHtml;
            }
        }

        throw new Error(
            "Não foi possível localizar o texto do capítulo no BL Novels."
        );
    }

    async cleanHtmlContent(html) {

        const doc = new Document(html);

        for (const selector of [
            ".sharedaddy",
            ".jp-relatedposts",
            ".post-navigation",
            ".navigation",
            ".comments",
            ".comment-respond",
            ".social-share",
            ".code-block",
            "script",
            "style",
            "noscript",
            "iframe",
            "form"
        ]) {

            for (const el of doc.select(selector)) {
                el.remove();
            }
        }

        const root =
            doc.selectFirst(".reading-content") ||
            doc.selectFirst(".chapter-content") ||
            doc.selectFirst(".entry-content") ||
            doc.selectFirst(".post-content") ||
            doc.selectFirst("article") ||
            doc.selectFirst("body");

        return root
            ? root.outerHtml
            : html;
    }

    getFilterList() {
        throw new Error(
            "getFilterList not implemented."
        );
    }

    getSourcePreferences() {
        throw new Error(
            "getSourcePreferences not implemented."
        );
    }
}
