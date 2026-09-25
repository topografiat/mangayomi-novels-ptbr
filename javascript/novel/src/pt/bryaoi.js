const mangayomiSources = [{
    "name": "BR Yaoi - Novels",
    "lang": "pt",
    "baseUrl": "https://bryaoi.com",
    "apiUrl": "",
    "iconUrl": "https://bryaoi.com/favicon.ico",
    "typeSource": "single",
    "itemType": 2,
    "version": "0.1.5",
    "pkgPath": "novel/src/pt/bryaoi.js",
    "notes": "Novels em português do BR Yaoi."
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
                "BR Yaoi retornou HTTP " +
                res.statusCode
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
     * Pega a URL de maior resolução
     * quando o site utiliza srcset.
     */
    getSrcsetUrl(srcset) {

        if (!srcset) {
            return "";
        }

        const parts = srcset
            .split(",")
            .map(function(item) {
                return item.trim();
            })
            .filter(function(item) {
                return item.length > 0;
            });

        if (parts.length === 0) {
            return "";
        }

        const last = parts[parts.length - 1];

        const url = last
            .split(/\s+/)[0];

        return this.absoluteUrl(url);
    }


    /*
     * Procura uma imagem dentro de
     * determinado elemento.
     */
    imageUrl(element) {

        if (!element) {
            return "";
        }

        /*
         * Caso o próprio elemento seja uma imagem.
         */
        const directSrc =
            element.attr("data-src") ||
            element.attr("data-lazy-src") ||
            element.attr("data-original") ||
            element.attr("data-image") ||
            element.attr("data-url") ||
            element.attr("src");

        if (
            directSrc &&
            !directSrc.startsWith("data:")
        ) {

            const direct =
                this.absoluteUrl(directSrc);

            if (
                direct &&
                !direct.includes("logo") &&
                !direct.includes("icon") &&
                !direct.includes("avatar")
            ) {
                return direct;
            }
        }


        /*
         * Procura uma tag IMG dentro do elemento.
         */
        const img =
            element.selectFirst("img");

        if (img) {

            const src =
                img.attr("data-src") ||
                img.attr("data-lazy-src") ||
                img.attr("data-original") ||
                img.attr("data-image") ||
                img.attr("data-url") ||
                img.attr("src");

            if (
                src &&
                !src.startsWith("data:")
            ) {

                const result =
                    this.absoluteUrl(src);

                if (
                    result &&
                    !result.includes("logo") &&
                    !result.includes("icon") &&
                    !result.includes("avatar")
                ) {
                    return result;
                }
            }


            /*
             * srcset / data-srcset.
             */
            const srcset =
                img.attr("srcset") ||
                img.attr("data-srcset") ||
                img.attr("data-lazy-srcset");

            if (srcset) {

                const result =
                    this.getSrcsetUrl(srcset);

                if (result) {
                    return result;
                }
            }


            /*
             * Algumas páginas colocam a imagem
             * como background-image.
             */
            const style =
                img.attr("style") || "";

            const match =
                style.match(
                    /url\(['"]?([^'")]+)['"]?\)/i
                );

            if (
                match &&
                match[1]
            ) {

                return this.absoluteUrl(
                    match[1]
                );
            }
        }


        return "";
    }


    /*
     * Procura a capa da página inteira.
     */
    getPageImage(doc) {

        if (!doc) {
            return "";
        }


        /*
         * 1. Open Graph.
         *
         * Essa costuma ser a capa principal.
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
                meta.attr("content") ||
                "";

            if (!content) {
                continue;
            }

            if (
                property === "og:image" ||
                name === "og:image" ||
                property === "twitter:image" ||
                name === "twitter:image"
            ) {

                const url =
                    this.absoluteUrl(content);

                if (
                    url &&
                    !url.startsWith("data:")
                ) {
                    return url;
                }
            }
        }


        /*
         * 2. image_src.
         */
        for (const link of doc.select("link")) {

            const rel =
                (
                    link.attr("rel") ||
                    ""
                ).toLowerCase();

            const href =
                link.attr("href") ||
                "";

            if (
                rel.includes("image_src") &&
                href
            ) {

                return this.absoluteUrl(
                    href
                );
            }
        }


        /*
         * 3. Seletores específicos de
         * páginas WordPress.
         */
        const selectors = [

            ".summary_image img",
            ".summary_image",
            ".post-thumbnail img",
            ".post-thumbnail",
            ".wp-post-image",
            ".thumb img",
            ".thumbnail img",
            ".cover img",
            ".cover",
            ".book-img img",
            ".book-image img",
            ".entry-content img",
            "article img"
        ];


        for (const selector of selectors) {

            const element =
                doc.selectFirst(selector);

            if (!element) {
                continue;
            }

            const image =
                this.imageUrl(element);

            if (image) {
                return image;
            }
        }


        /*
         * 4. Último recurso:
         * procurar qualquer imagem útil.
         */
        for (const img of doc.select("img")) {

            const image =
                this.imageUrl(img);

            if (
                image &&
                !image.includes("logo") &&
                !image.includes("icon") &&
                !image.includes("avatar")
            ) {

                return image;
            }
        }


        return "";
    }


    /*
     * Verifica se o link é de uma obra.
     */
    isNovelUrl(link) {

        if (!link) {
            return false;
        }

        return (
            link.includes("/yaoi/") &&
            !link.includes("/ler/") &&
            !link.includes("/tag/") &&
            !link.includes("/category/") &&
            !link.includes("/page/")
        );
    }


    /*
     * Verifica se o link parece ser um capítulo.
     *
     * Não dependemos mais somente da palavra
     * "Capítulo", pois existem Side Story,
     * Extras, Prólogo etc.
     */
    isChapterLink(link, text) {

        if (!link) {
            return false;
        }

        if (!link.includes("/ler/")) {
            return false;
        }

        const name =
            this.cleanText(text);

        if (!name) {
            return false;
        }

        /*
         * Tudo que estiver em /ler/ dentro
         * da página da obra é tratado como
         * possível capítulo.
         *
         * Isso permite:
         * Capítulo 01
         * Capítulo 01.5
         * Capítulo Side Story 01
         * Prólogo
         * Extra
         * etc.
         */

        return true;
    }


    /*
     * Extrai capítulos da página da obra.
     */
    extractChapters(doc) {

        const chapters = [];
        const seen = {};


        for (const a of doc.select("a")) {

            const href =
                a.attr("href") ||
                "";

            const text =
                this.cleanText(
                    a.text || ""
                );

            const link =
                this.absoluteUrl(href);


            if (
                !this.isChapterLink(
                    link,
                    text
                )
            ) {
                continue;
            }


            if (seen[link]) {
                continue;
            }


            /*
             * Evita links estranhos que não
             * sejam capítulos.
             */
            if (
                text.length > 200
            ) {
                continue;
            }


            seen[link] = true;


            chapters.push({
                name: text,
                url: link,
                scanlator: "BR Yaoi"
            });
        }


        return chapters;
    }


    async getNovelList(page) {

        const n =
            page || 1;

        const url =
            n === 1
                ? this.source.baseUrl +
                  "/category/novel/"
                : this.source.baseUrl +
                  "/category/novel/page/" +
                  n +
                  "/";


        const doc =
            await this.fetch(url);


        const list = [];
        const seen = {};


        /*
         * Primeiro tenta os locais mais
         * comuns da listagem.
         */
        const selectors = [

            "main article a",
            "article a",
            ".post a",
            ".blog-post a",
            ".item-summary a",
            ".page-item-detail a",
            ".c-tabs-item__content a"
        ];


        for (const selector of selectors) {

            for (const a of doc.select(selector)) {

                const href =
                    a.attr("href") ||
                    "";

                const name =
                    this.cleanText(
                        a.text || ""
                    );

                const link =
                    this.absoluteUrl(href);


                if (
                    !name ||
                    !this.isNovelUrl(link) ||
                    seen[link]
                ) {
                    continue;
                }


                seen[link] = true;


                /*
                 * Tenta a capa diretamente no
                 * card/link.
                 */
                let image =
                    this.imageUrl(a);


                /*
                 * Se não encontrou, procura no
                 * elemento pai.
                 */
                if (!image) {

                    const parent =
                        a.parent();

                    if (parent) {
                        image =
                            this.imageUrl(
                                parent
                            );
                    }
                }


                list.push({
                    name: name,
                    link: link,
                    imageUrl: image
                });
            }
        }


        /*
         * Fallback geral.
         */
        if (list.length === 0) {

            for (const a of doc.select("a")) {

                const href =
                    a.attr("href") ||
                    "";

                const name =
                    this.cleanText(
                        a.text || ""
                    );

                const link =
                    this.absoluteUrl(href);


                if (
                    !name ||
                    !this.isNovelUrl(link) ||
                    seen[link]
                ) {
                    continue;
                }


                seen[link] = true;


                list.push({
                    name: name,
                    link: link,
                    imageUrl:
                        this.imageUrl(a)
                });
            }
        }


        /*
         * Detecta próxima página.
         */
        let hasNextPage =
            false;


        for (const a of doc.select("a")) {

            const text =
                this.cleanText(
                    a.text || ""
                ).toLowerCase();

            const href =
                a.attr("href") ||
                "";


            if (
                href.includes(
                    "/category/novel/page/" +
                    (n + 1) +
                    "/"
                ) ||
                text === "»" ||
                text.includes("próxima") ||
                text.includes("mais antigos")
            ) {

                hasNextPage = true;
                break;
            }
        }


        return {
            list: list,
            hasNextPage:
                hasNextPage
        };
    }


    async getPopular(page) {

        return await this.getNovelList(
            page
        );
    }


    get supportsLatest() {

        return true;
    }


    async getLatestUpdates(page) {

        return await this.getNovelList(
            page
        );
    }


    async search(
        query,
        page,
        filters
    ) {

        const n =
            page || 1;


        let url =
            this.source.baseUrl +
            "/?s=" +
            encodeURIComponent(
                query
            );


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
                a.attr("href") ||
                "";

            const name =
                this.cleanText(
                    a.text || ""
                );

            const link =
                this.absoluteUrl(href);


            if (
                !name ||
                !this.isNovelUrl(link) ||
                seen[link]
            ) {
                continue;
            }


            seen[link] = true;


            let image =
                this.imageUrl(a);


            if (!image) {

                const parent =
                    a.parent();

                if (parent) {
                    image =
                        this.imageUrl(
                            parent
                        );
                }
            }


            list.push({
                name: name,
                link: link,
                imageUrl: image
            });
        }


        /*
         * Se houver resultados contendo
         * "novel", prioriza esses resultados.
         */
        const novels =
            list.filter(
                function(item) {
                    return item.name
                        .toLowerCase()
                        .includes("novel");
                }
            );


        return {
            list:
                novels.length
                    ? novels
                    : list,
            hasNextPage:
                false
        };
    }


    async getDetail(url) {

        const doc =
            await this.fetch(url);


        /*
         * Nome.
         */
        const h1 =
            doc.selectFirst("h1");


        const name =
            h1
                ? this.cleanText(
                    h1.text
                  )
                : url;


        /*
         * Descrição.
         */
        let description =
            "";


        const metaDescription =
            doc.selectFirst(
                'meta[name="description"]'
            );


        if (metaDescription) {

            description =
                this.cleanText(
                    metaDescription.attr(
                        "content"
                    ) || ""
                );
        }


        if (!description) {

            const descriptionSelectors = [

                ".sinopse",
                ".summary",
                ".description",
                ".entry-content p",
                ".post-content p"
            ];


            for (
                const selector
                of descriptionSelectors
            ) {

                const el =
                    doc.selectFirst(
                        selector
                    );


                if (!el) {
                    continue;
                }


                const text =
                    this.cleanText(
                        el.text || ""
                    );


                if (
                    text.length > 30
                ) {

                    description =
                        text;

                    break;
                }
            }
        }


        /*
         * CAPA
         *
         * Agora usamos vários métodos.
         */
        let coverUrl =
            this.getPageImage(doc);


        /*
         * Autor.
         */
        let author =
            "";


        for (const selector of [
            ".author",
            ".author-content",
            ".summary-content .author",
            ".summary_content .author"
        ]) {

            const el =
                doc.selectFirst(
                    selector
                );


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


        /*
         * CAPÍTULOS
         *
         * Não limitamos mais por "Capítulo".
         * Qualquer link /ler/ da página
         * pode ser capítulo.
         */
        let chapters =
            this.extractChapters(
                doc
            );


        /*
         * Caso algum link de capítulo
         * apareça duplicado em outro lugar,
         * remove duplicados novamente.
         */
        const uniqueChapters = [];
        const chapterSeen = {};


        for (const chapter of chapters) {

            if (
                chapterSeen[
                    chapter.url
                ]
            ) {
                continue;
            }


            chapterSeen[
                chapter.url
            ] = true;


            uniqueChapters.push(
                chapter
            );
        }


        /*
         * O BR Yaoi normalmente mostra
         * o capítulo mais antigo primeiro
         * na página.
         *
         * Mantemos a ordem encontrada,
         * que é mais segura para novels.
         */
        chapters =
            uniqueChapters;


        return {

            name: name,

            link: url,

            imageUrl:
                coverUrl || "",

            description:
                description,

            author:
                author,

            genre: [
                "Novel",
                "PT-BR"
            ],

            status: 1,

            chapters:
                chapters
        };
    }


    async getHtmlContent(
        name,
        url
    ) {

        const doc =
            await this.fetch(url);


        /*
         * Primeiro verifica se o capítulo
         * é composto por imagens.
         */
        const imageSelectors = [

            ".reading-content img",
            ".chapter-content img",
            ".entry-content img",
            ".post-content img",
            "div.text-left img",
            ".read-container img",
            ".page-break img",
            "article img"
        ];


        let imagesHtml =
            "";


        for (
            const selector
            of imageSelectors
        ) {

            const imgs =
                doc.select(
                    selector
                );


            if (
                !imgs ||
                imgs.length === 0
            ) {
                continue;
            }


            for (
                const img
                of imgs
            ) {

                const src =
                    img.attr(
                        "data-src"
                    ) ||
                    img.attr(
                        "data-lazy-src"
                    ) ||
                    img.attr(
                        "data-original"
                    ) ||
                    img.attr(
                        "src"
                    );


                if (
                    src &&
                    !src.includes("icon") &&
                    !src.includes("logo")
                ) {

                    imagesHtml +=
                        '<img src="' +
                        this.absoluteUrl(
                            src
                        ) +
                        '"/><br>';
                }
            }


            if (
                imagesHtml.length > 0
            ) {

                return imagesHtml;
            }
        }


        /*
         * Agora procura texto.
         */
        const selectors = [

            ".entry-content",
            ".reading-content",
            ".chapter-content",
            ".post-content",
            "article .content",
            "article",
            ".ep-content",
            ".reader-area",
            ".text-left",
            ".chapter-container",
            ".rd-container"
        ];


        for (
            const selector
            of selectors
        ) {

            const content =
                doc.selectFirst(
                    selector
                );


            if (!content) {
                continue;
            }


            const text =
                (
                    content.text || ""
                ).trim();


            if (
                text.length > 100
            ) {

                return content.outerHtml;
            }
        }


        /*
         * Fallback: juntar os parágrafos.
         */
        const paragraphs =
            doc.select("p");


        if (
            paragraphs &&
            paragraphs.length > 0
        ) {

            let combinedHtml =
                "";


            for (
                const p
                of paragraphs
            ) {

                combinedHtml +=
                    p.outerHtml;
            }


            if (
                combinedHtml.length > 100
            ) {

                return combinedHtml;
            }
        }


        throw new Error(
            "Não foi possível localizar o conteúdo (texto ou imagens) neste capítulo."
        );
    }


    async cleanHtmlContent(
        html
    ) {

        const doc =
            new Document(html);


        for (
            const selector
            of [

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
                "iframe"
            ]
        ) {

            for (
                const el
                of doc.select(
                    selector
                )
            ) {

                el.remove();
            }
        }


        const root =
            doc.selectFirst(
                ".entry-content"
            ) ||
            doc.selectFirst(
                ".reading-content"
            ) ||
            doc.selectFirst(
                ".chapter-content"
            ) ||
            doc.selectFirst(
                ".post-content"
            ) ||
            doc.selectFirst(
                "article"
            ) ||
            doc.selectFirst(
                "body"
            );


        return root
            ? root.outerHtml
            : html;
    }


    getFilterList() {

        throw new Error(
            "getFilterList not implemented"
        );
    }


    getSourcePreferences() {

        throw new Error(
            "getSourcePreferences not implemented"
        );
    }
}
