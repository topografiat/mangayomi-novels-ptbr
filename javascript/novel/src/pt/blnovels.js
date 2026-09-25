const mangayomiSources = [{
    "name": "BL Novels",
    "lang": "pt",
    "baseUrl": "https://blnovels.com",
    "apiUrl": "",
    "iconUrl": "https://blnovels.com/favicon.ico",
    "typeSource": "single",
    "itemType": 2,
    "version": "0.1.3",
    "pkgPath": "novel/src/pt/blnovels.js",
    "notes": "Novels em português do BL Novels."
}];

class DefaultExtension extends MProvider {

    getHeaders(url) {
        return {
            "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
            "Referer": this.source.baseUrl + "/"
        };
    }

    absoluteUrl(href) {
        if (!href) return "";

        href = href.trim();

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

    getMetaImage(doc) {
        const selectors = [
            'meta[property="og:image"]',
            'meta[property="og:image:url"]',
            'meta[name="twitter:image"]',
            'meta[itemprop="image"]'
        ];

        for (const selector of selectors) {
            const el = doc.selectFirst(selector);

            if (el) {
                const content = el.attr("content") || "";

                if (content &&
                    !content.includes("logo") &&
                    !content.includes("favicon")) {
                    return this.absoluteUrl(content);
                }
            }
        }

        return "";
    }

    getImageFromElement(element) {
        if (!element) return "";

        const img = element.selectFirst("img");

        if (!img) return "";

        const attributes = [
            "data-src",
            "data-lazy-src",
            "data-original",
            "data-original-src",
            "data-image",
            "data-url",
            "data-cfsrc",
            "src"
        ];

        for (const attr of attributes) {
            const value = img.attr(attr) || "";

            if (!value) continue;

            if (
                value.includes("logo") ||
                value.includes("favicon") ||
                value.includes("avatar")
            ) {
                continue;
            }

            return this.absoluteUrl(value);
        }

        return "";
    }

    getPageImage(doc) {

        // Primeiro tenta OpenGraph
        const metaImage = this.getMetaImage(doc);

        if (metaImage) {
            return metaImage;
        }

        // Depois procura imagens comuns
        const selectors = [
            ".summary_image img",
            ".tab-summary .summary_image img",
            ".post-title .summary_image img",
            ".c-tabs-item__content img",
            ".page-item-detail img",
            ".item-summary img",
            "article img"
        ];

        for (const selector of selectors) {
            const img = doc.selectFirst(selector);

            if (!img) continue;

            const url =
                img.attr("data-src") ||
                img.attr("data-lazy-src") ||
                img.attr("data-original") ||
                img.attr("data-original-src") ||
                img.attr("src") ||
                "";

            if (!url) continue;

            if (
                url.includes("logo") ||
                url.includes("favicon") ||
                url.includes("avatar")
            ) {
                continue;
            }

            return this.absoluteUrl(url);
        }

        // Último recurso: primeira imagem válida
        for (const img of doc.select("img")) {

            const url =
                img.attr("data-src") ||
                img.attr("data-lazy-src") ||
                img.attr("data-original") ||
                img.attr("data-original-src") ||
                img.attr("src") ||
                "";

            if (!url) continue;

            if (
                url.includes("logo") ||
                url.includes("favicon") ||
                url.includes("avatar")
            ) {
                continue;
            }

            return this.absoluteUrl(url);
        }

        return "";
    }

    isNovelUrl(link) {
        if (!link) return false;

        if (!link.includes("/novel/")) {
            return false;
        }

        const part = link.split("/novel/")[1] || "";

        const pieces = part
            .split("/")
            .filter(x => x.trim() !== "");

        // Uma novela possui:
        // /novel/nome-da-novel/
        //
        // Um capítulo possui:
        // /novel/nome-da-novel/capitulo-1/
        //
        return pieces.length === 1;
    }

    isChapterOfNovel(link, novelUrl) {
        if (!link || !novelUrl) return false;

        let base = novelUrl;

        if (!base.endsWith("/")) {
            base += "/";
        }

        if (!link.startsWith(base)) {
            return false;
        }

        const remaining = link.substring(base.length);

        if (!remaining) {
            return false;
        }

        const pieces = remaining
            .split("/")
            .filter(x => x.trim() !== "");

        return pieces.length >= 1;
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

            if (!this.isNovelUrl(link)) {
                continue;
            }

            if (seen[link]) {
                continue;
            }

            let name = this.cleanText(a.text || "");

            if (!name) {
                continue;
            }

            // Evita links que não são títulos de novelas
            if (
                name.toLowerCase() === "ler do início" ||
                name.toLowerCase() === "último capítulo" ||
                name.toLowerCase() === "ler"
            ) {
                continue;
            }

            seen[link] = true;

            let imageUrl = this.getImageFromElement(a);

            // Se a imagem não estiver no próprio link,
            // tenta encontrar no elemento pai.
            if (!imageUrl) {

                const parent = a.parent();

                if (parent) {
                    imageUrl = this.getImageFromElement(parent);
                }
            }

            list.push({
                name: name,
                link: link,
                imageUrl: imageUrl
            });
        }

        // Verifica próxima página
        let hasNextPage = false;

        for (const a of doc.select("a")) {

            const href = a.attr("href") || "";

            const text = this.cleanText(
                a.text || ""
            ).toLowerCase();

            if (
                href.includes("/page/" + (n + 1) + "/") ||
                text.includes("posts mais antigos") ||
                text.includes("próxima") ||
                text.includes("next")
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

            if (!this.isNovelUrl(link)) {
                continue;
            }

            if (seen[link]) {
                continue;
            }

            const name = this.cleanText(a.text || "");

            if (!name) {
                continue;
            }

            seen[link] = true;

            let imageUrl = this.getImageFromElement(a);

            if (!imageUrl) {

                const parent = a.parent();

                if (parent) {
                    imageUrl = this.getImageFromElement(parent);
                }
            }

            list.push({
                name: name,
                link: link,
                imageUrl: imageUrl
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
            const title = doc.selectFirst("title");

            if (title) {
                name = this.cleanText(title.text)
                    .replace(/\s*-\s*BL Novels.*$/i, "");
            }
        }

        let description = "";

        const descriptionSelectors = [
            ".description-summary",
            ".summary_content",
            ".summary",
            ".description",
            ".entry-content",
            "article"
        ];

        for (const selector of descriptionSelectors) {

            const el = doc.selectFirst(selector);

            if (!el) continue;

            const text = this.cleanText(
                el.text || ""
            );

            if (text.length > 40) {
                description = text;
                break;
            }
        }

        let author = "";

        const authorSelectors = [
            ".author-content",
            ".author",
            ".summary_content .author"
        ];

        for (const selector of authorSelectors) {

            const el = doc.selectFirst(selector);

            if (!el) continue;

            author = this.cleanText(
                el.text || ""
            );

            if (author) {
                break;
            }
        }

        /*
         * CAPÍTULOS
         *
         * O BL Novels usa vários formatos:
         *
         * /novel/nome/capitulo-1/
         * /novel/nome/capitulo-final/
         * /novel/nome/volume-2/215/
         *
         * Portanto não vamos depender do texto
         * "Capítulo".
         */

        const chapters = [];
        const seen = {};

        let novelBase = url;

        if (!novelBase.endsWith("/")) {
            novelBase += "/";
        }

        for (const a of doc.select("a")) {

            const href = a.attr("href") || "";
            const link = this.absoluteUrl(href);

            if (!link) continue;

            if (!this.isChapterOfNovel(link, url)) {
                continue;
            }

            if (seen[link]) {
                continue;
            }

            let chapterName = this.cleanText(
                a.text || ""
            );

            if (!chapterName) {
                continue;
            }

            /*
             * Ignora links de navegação que possam
             * aparecer dentro da página.
             */

            const lower = chapterName.toLowerCase();

            if (
                lower === "home" ||
                lower === "arquivo" ||
                lower === "completas" ||
                lower === "nacionais" ||
                lower === "mais recentes" ||
                lower === "a-z" ||
                lower === "votos" ||
                lower === "tendências" ||
                lower === "mais vistas"
            ) {
                continue;
            }

            seen[link] = true;

            chapters.push({
                name: chapterName,
                url: link,
                scanlator: "BL Novels"
            });
        }

        /*
         * O site normalmente apresenta do mais
         * recente para o mais antigo.
         */
        chapters.reverse();

        return {
            name: name,
            link: url,
            imageUrl: this.getPageImage(doc),
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

        const selectors = [
            ".reading-content",
            ".chapter-content",
            ".entry-content",
            ".post-content",
            ".content-area",
            "article"
        ];

        for (const selector of selectors) {

            const content = doc.selectFirst(selector);

            if (!content) {
                continue;
            }

            const text = this.cleanText(
                content.text || ""
            );

            if (text.length > 100) {
                return content.outerHtml;
            }
        }

        const body = doc.selectFirst("body");

        if (body) {

            const text = this.cleanText(
                body.text || ""
            );

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

        const removeSelectors = [
            "script",
            "style",
            "noscript",
            "iframe",
            "form",
            ".comments",
            ".comment-respond",
            ".sharedaddy",
            ".jp-relatedposts",
            ".post-navigation",
            ".navigation",
            ".social-share"
        ];

        for (const selector of removeSelectors) {

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
