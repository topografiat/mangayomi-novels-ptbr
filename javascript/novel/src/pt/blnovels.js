const mangayomiSources = [{
    "name": "BL Novels",
    "lang": "pt",
    "baseUrl": "https://blnovels.com",
    "apiUrl": "",
    "iconUrl": "https://blnovels.com/favicon.ico",
    "typeSource": "single",
    "itemType": 2,
    "version": "0.1.1",
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

        if (!href) {
            return "";
        }

        href = href.trim();

        if (
            href.startsWith("http://") ||
            href.startsWith("https://")
        ) {
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


    /*
     * Converte uma URL encontrada em
     * srcset para uma URL normal.
     */
    getSrcsetUrl(srcset) {

        if (!srcset) {
            return "";
        }

        const parts = srcset
            .split(",")
            .map(function (item) {
                return item.trim();
            })
            .filter(function (item) {
                return item.length > 0;
            });

        if (parts.length === 0) {
            return "";
        }

        /*
         * Normalmente a última imagem do srcset
         * possui a maior resolução.
         */
        const last = parts[parts.length - 1];

        const url = last
            .split(/\s+/)[0];

        return this.absoluteUrl(url);
    }


    /*
     * Procura a capa dentro de um elemento,
     * normalmente um <a>.
     */
    imageUrl(element) {

        if (!element) {
            return "";
        }

        const img = element.selectFirst("img");

        if (!img) {
            return "";
        }

        const candidates = [
            img.attr("data-src"),
            img.attr("data-lazy-src"),
            img.attr("data-original"),
            img.attr("data-image"),
            img.attr("data-url"),
            img.attr("data-fallback-src"),
            img.attr("src")
        ];

        for (const value of candidates) {

            if (!value) {
                continue;
            }

            const url = this.absoluteUrl(value);

            if (
                url &&
                !url.startsWith("data:")
            ) {
                return url;
            }
        }

        const srcset = img.attr("srcset") ||
                       img.attr("data-srcset") ||
                       img.attr("data-lazy-srcset");

        if (srcset) {
            return this.getSrcsetUrl(srcset);
        }

        /*
         * Alguns sites usam a capa como
         * background-image.
         */
        const style = img.attr("style") || "";

        const match = style.match(
            /url\(['"]?([^'")]+)['"]?\)/i
        );

        if (match && match[1]) {
            return this.absoluteUrl(match[1]);
        }

        return "";
    }


    /*
     * Procura a imagem principal da página.
     *
     * Prioridade:
     * 1. og:image
     * 2. twitter:image
     * 3. image_src
     * 4. imagens da página
     */
    documentImageUrl(doc) {

        if (!doc) {
            return "";
        }

        /*
         * Primeiro procura Open Graph.
         */
        for (const meta of doc.select("meta")) {

            const property =
                (
                    meta.attr("property") ||
                    ""
                ).toLowerCase();

            const name =
                (
                    meta.attr("name") ||
                    ""
                ).toLowerCase();

            const content =
                meta.attr("content") || "";

            if (!content) {
                continue;
            }

            if (
                property === "og:image" ||
                name === "og:image" ||
                name === "twitter:image" ||
                property === "twitter:image"
            ) {

                const url = this.absoluteUrl(
                    content
                );

                if (
                    url &&
                    !url.startsWith("data:")
                ) {
                    return url;
                }
            }
        }


        /*
         * image_src tradicional.
         */
        for (const link of doc.select("link")) {

            const rel =
                (
                    link.attr("rel") ||
                    ""
                ).toLowerCase();

            const href =
                link.attr("href") || "";

            if (
                rel.includes("image_src") &&
                href
            ) {
                return this.absoluteUrl(href);
            }
        }


        /*
         * Tenta classes comuns de capa.
         */
        const selectors = [
            ".summary_image img",
            ".summary_image",
            ".book-img img",
            ".book-image img",
            ".novel-cover img",
            ".novel-cover",
            ".cover img",
            ".cover",
            ".thumbnail img",
            ".post-thumbnail img",
            ".wp-post-image",
            "article img"
        ];

        for (const selector of selectors) {

            const element =
                doc.selectFirst(selector);

            if (!element) {
                continue;
            }

            const url =
                this.imageUrl(element);

            if (url) {
                return url;
            }

            /*
             * Caso o elemento seja uma própria imagem.
             */
            const direct =
                element.attr("data-src") ||
                element.attr("data-lazy-src") ||
                element.attr("data-original") ||
                element.attr("src");

            if (direct) {
                return this.absoluteUrl(direct);
            }
        }


        /*
         * Último recurso: primeira imagem
         * válida encontrada na página.
         */
        for (const img of doc.select("img")) {

            const url = this.imageUrl(img);

            if (
                url &&
                !url.includes("logo") &&
                !url.includes("avatar") &&
                !url.includes("icon")
            ) {
                return url;
            }
        }

        return "";
    }


    /*
     * Procura a capa abrindo a página
     * individual da novel.
     *
     * Isso é usado quando a página inicial
     * não fornece a imagem diretamente.
     */
    async getNovelImage(url) {

        try {

            const doc =
                await this.fetch(url);

            return this.documentImageUrl(doc);

        } catch (e) {

            return "";
        }
    }


    isNovelUrl(link) {

        return link.includes("/novel/") &&
            !link.includes("/capitulo-") &&
            !link.includes("/tag/") &&
            !link.includes("/category/");
    }


    async getNovelList(page) {

        const n = page || 1;

        const url =
            n === 1
                ? this.source.baseUrl + "/"
                : this.source.baseUrl +
                  "/page/" +
                  n +
                  "/";

        const doc =
            await this.fetch(url);

        const list = [];
        const seen = {};

        for (const a of doc.select("a")) {

            const href =
                a.attr("href") || "";

            const link =
                this.absoluteUrl(href);

            const name =
                this.cleanText(
                    a.text || ""
                );

            if (!name) {
                continue;
            }

            if (!this.isNovelUrl(link)) {
                continue;
            }

            if (seen[link]) {
                continue;
            }

            if (
                /^cap[ií]tulo\b/i.test(name) ||
                /^extra\b/i.test(name)
            ) {
                continue;
            }

            seen[link] = true;

            let image =
                this.imageUrl(a);

            /*
             * Se não encontrou a capa no link,
             * abre a página individual da novel.
             */
            if (!image) {
                image =
                    await this.getNovelImage(link);
            }

            list.push({
                name: name,
                link: link,
                imageUrl: image
            });
        }


        let hasNextPage = false;

        for (const a of doc.select("a")) {

            const href =
                a.attr("href") || "";

            const text =
                this.cleanText(
                    a.text || ""
                ).toLowerCase();

            if (
                href.includes(
                    "/page/" +
                    (n + 1) +
                    "/"
                ) ||
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

            url +=
                "&paged=" +
                n;
        }

        const doc =
            await this.fetch(url);

        const list = [];
        const seen = {};

        for (const a of doc.select("a")) {

            const href =
                a.attr("href") || "";

            const link =
                this.absoluteUrl(href);

            const name =
                this.cleanText(
                    a.text || ""
                );

            if (!name) {
                continue;
            }

            if (!this.isNovelUrl(link)) {
                continue;
            }

            if (seen[link]) {
                continue;
            }

            seen[link] = true;

            let image =
                this.imageUrl(a);

            if (!image) {
                image =
                    await this.getNovelImage(link);
            }

            list.push({
                name: name,
                link: link,
                imageUrl: image
            });
        }


        return {
            list: list,
            hasNextPage: false
        };
    }


    async getDetail(url) {

        const doc =
            await this.fetch(url);

        let name = "";

        const h1 =
            doc.selectFirst("h1");

        if (h1) {

            name =
                this.cleanText(
                    h1.text
                );
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

            const el =
                doc.selectFirst(selector);

            if (!el) {
                continue;
            }

            const txt =
                this.cleanText(
                    el.text || ""
                );

            if (txt.length > 40) {

                description =
                    txt;

                break;
            }
        }


        let author = "";

        for (const selector of [
            ".author-content",
            ".author",
            ".summary_content .author"
        ]) {

            const el =
                doc.selectFirst(selector);

            if (el) {

                author =
                    this.cleanText(
                        el.text || ""
                    );

                if (author) {
                    break;
                }
            }
        }


        const chapters = [];
        const seen = {};


        for (const a of doc.select("a")) {

            const href =
                a.attr("href") || "";

            const link =
                this.absoluteUrl(href);

            const text =
                this.cleanText(
                    a.text || ""
                );

            if (!link) {
                continue;
            }

            if (!link.includes("/novel/")) {
                continue;
            }

            if (link === url) {
                continue;
            }

            if (seen[link]) {
                continue;
            }

            if (
                !/cap[ií]tulo|extra|pr[oó]logo|sinopse|aviso|in[ií]cio|gloss[aá]rio|personagens/i.test(text)
            ) {
                continue;
            }

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


        chapters.reverse();


        /*
         * Aqui usamos o novo sistema
         * de busca de capas.
         */
        const image =
            this.documentImageUrl(doc);


        return {
            name: name,
            link: url,
            imageUrl: image,
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

        const doc =
            await this.fetch(url);


        for (const selector of [
            ".reading-content",
            ".chapter-content",
            ".entry-content",
            ".post-content",
            "article .content",
            "article"
        ]) {

            const content =
                doc.selectFirst(selector);

            if (!content) {
                continue;
            }

            const text =
                (
                    content.text || ""
                ).trim();

            if (text.length > 100) {

                return content.outerHtml;
            }
        }


        const body =
            doc.selectFirst("body");

        if (body) {

            const text =
                (
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

        const doc =
            new Document(html);


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

            for (
                const el
                of doc.select(selector)
            ) {

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
