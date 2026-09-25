const mangayomiSources = [{
    "name": "BL Novels",
    "lang": "pt",
    "baseUrl": "https://blnovels.com",
    "apiUrl": "",
    "iconUrl": "https://blnovels.com/favicon.ico",
    "typeSource": "single",
    "itemType": 2,
    "version": "0.1.2",
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
                "BL Novels retornou HTTP " +
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
     * -------------------------------------------------
     * URL DE IMAGEM A PARTIR DE SRCSET
     * -------------------------------------------------
     */

    getSrcsetUrl(srcset) {

        if (!srcset) {
            return "";
        }

        const parts =
            srcset
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


        /*
         * Normalmente o último item possui
         * a maior resolução.
         */
        const last =
            parts[parts.length - 1];


        const url =
            last.split(/\s+/)[0];


        return this.absoluteUrl(url);
    }


    /*
     * -------------------------------------------------
     * EXTRATOR DE IMAGEM
     * -------------------------------------------------
     */

    imageUrl(element) {

        if (!element) {
            return "";
        }


        /*
         * Caso o próprio elemento seja IMG.
         */
        const direct =
            element.attr("data-src") ||
            element.attr("data-lazy-src") ||
            element.attr("data-original") ||
            element.attr("data-image") ||
            element.attr("data-url") ||
            element.attr("data-fallback-src") ||
            element.attr("src");


        if (
            direct &&
            !direct.startsWith("data:")
        ) {

            const result =
                this.absoluteUrl(direct);


            if (
                result &&
                !result.includes("logo") &&
                !result.includes("favicon") &&
                !result.includes("avatar") &&
                !result.includes("icon")
            ) {

                return result;
            }
        }


        /*
         * Procura IMG dentro do elemento.
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
                    !result.includes("favicon") &&
                    !result.includes("avatar") &&
                    !result.includes("icon")
                ) {

                    return result;
                }
            }


            /*
             * SRCSET.
             */
            const srcset =
                img.attr("srcset") ||
                img.attr("data-srcset") ||
                img.attr("data-lazy-srcset");


            if (srcset) {

                const result =
                    this.getSrcsetUrl(
                        srcset
                    );


                if (result) {
                    return result;
                }
            }


            /*
             * Background image.
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


        /*
         * Background-image no próprio card.
         */
        const style =
            element.attr("style") || "";


        const bgMatch =
            style.match(
                /url\(['"]?([^'")]+)['"]?\)/i
            );


        if (
            bgMatch &&
            bgMatch[1]
        ) {

            return this.absoluteUrl(
                bgMatch[1]
            );
        }


        return "";
    }


    /*
     * -------------------------------------------------
     * CAPA PRINCIPAL DA PÁGINA
     * -------------------------------------------------
     */

    getPageImage(doc) {

        if (!doc) {
            return "";
        }


        /*
         * 1. Open Graph
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
                property === "og:image:url" ||
                name === "twitter:image" ||
                property === "twitter:image"
            ) {

                const url =
                    this.absoluteUrl(
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
         * 2. image_src
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
         * 3. Seletores específicos
         * de sites WordPress.
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
            ".post-thumbnail",

            ".wp-post-image",

            ".c-image-hover img",
            ".item-summary img",

            ".entry-content img",

            "article img"
        ];


        for (
            const selector
            of selectors
        ) {

            const element =
                doc.selectFirst(
                    selector
                );


            if (!element) {
                continue;
            }


            const image =
                this.imageUrl(
                    element
                );


            if (image) {
                return image;
            }
        }


        /*
         * 4. Última tentativa:
         * primeira imagem útil da página.
         */
        for (
            const img
            of doc.select("img")
        ) {

            const image =
                this.imageUrl(img);


            if (
                image &&
                !image.includes("logo") &&
                !image.includes("favicon") &&
                !image.includes("avatar") &&
                !image.includes("icon")
            ) {

                return image;
            }
        }


        return "";
    }


    /*
     * -------------------------------------------------
     * BUSCA CAPA DA PÁGINA INDIVIDUAL
     * -------------------------------------------------
     */

    async getNovelImage(url) {

        try {

            const doc =
                await this.fetch(url);


            return this.getPageImage(
                doc
            );

        } catch (e) {

            return "";
        }
    }


    /*
     * -------------------------------------------------
     * IDENTIFICA URL DE NOVEL
     * -------------------------------------------------
     */

    isNovelUrl(link) {

        if (!link) {
            return false;
        }


        return (
            link.includes("/novel/") &&
            !link.includes("/chapter/") &&
            !link.includes("/capitulo/") &&
            !link.includes("/tag/") &&
            !link.includes("/category/")
        );
    }


    /*
     * -------------------------------------------------
     * IDENTIFICA CAPÍTULO
     * -------------------------------------------------
     *
     * Agora não dependemos somente da palavra
     * "Capítulo".
     */

    isChapterLink(link, text) {

        if (!link) {
            return false;
        }


        /*
         * O link precisa apontar para algum
         * conteúdo dentro da estrutura da novel.
         */
        const lowerLink =
            link.toLowerCase();


        const lowerText =
            this.cleanText(
                text
            ).toLowerCase();


        /*
         * Padrões comuns.
         */
        const looksLikeChapter =
            lowerLink.includes("/chapter/") ||
            lowerLink.includes("/capitulo/") ||
            lowerLink.includes("/capítulo/") ||

            lowerText.includes("capítulo") ||
            lowerText.includes("capitulo") ||

            lowerText.includes("chapter") ||

            lowerText.includes("prólogo") ||
            lowerText.includes("prologo") ||

            lowerText.includes("extra") ||

            lowerText.includes("side story") ||

            lowerText.includes("epílogo") ||
            lowerText.includes("epilogo");


        return looksLikeChapter;
    }


    /*
     * -------------------------------------------------
     * EXTRAI CAPÍTULOS
     * -------------------------------------------------
     */

    extractChapters(doc) {

        const chapters = [];
        const seen = {};


        for (
            const a
            of doc.select("a")
        ) {

            const href =
                a.attr("href") ||
                "";


            const link =
                this.absoluteUrl(
                    href
                );


            const text =
                this.cleanText(
                    a.text || ""
                );


            if (
                !this.isChapterLink(
                    link,
                    text
                )
            ) {
                continue;
            }


            if (!text) {
                continue;
            }


            if (seen[link]) {
                continue;
            }


            /*
             * Evita textos absurdamente grandes.
             */
            if (
                text.length > 250
            ) {
                continue;
            }


            seen[link] = true;


            chapters.push({

                name: text,

                url: link,

                scanlator:
                    "BL Novels"
            });
        }


        return chapters;
    }


    /*
     * -------------------------------------------------
     * LISTAGEM DE NOVELS
     * -------------------------------------------------
     */

    async getNovelList(page) {

        const n =
            page || 1;


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


        /*
         * Primeiro procura cards.
         */
        const selectors = [

            "article a",

            ".post a",

            ".item-summary a",

            ".item-summary",

            ".page-item-detail a",

            ".c-tabs-item__content a",

            ".row.c-tabs-item__content a"
        ];


        for (
            const selector
            of selectors
        ) {

            for (
                const a
                of doc.select(selector)
            ) {

                const href =
                    a.attr("href") ||
                    "";


                const link =
                    this.absoluteUrl(
                        href
                    );


                const name =
                    this.cleanText(
                        a.text || ""
                    );


                if (
                    !name ||
                    !this.isNovelUrl(
                        link
                    ) ||
                    seen[link]
                ) {
                    continue;
                }


                seen[link] = true;


                /*
                 * Primeira tentativa:
                 * imagem no próprio card.
                 */
                let image =
                    this.imageUrl(a);


                /*
                 * Segunda tentativa:
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


                /*
                 * Terceira tentativa:
                 * página individual.
                 *
                 * Isso é mais lento, mas permite
                 * recuperar capas que não aparecem
                 * na listagem.
                 */
                if (!image) {

                    image =
                        await this.getNovelImage(
                            link
                        );
                }


                list.push({

                    name: name,

                    link: link,

                    imageUrl:
                        image
                });
            }
        }


        /*
         * Fallback geral.
         */
        if (
            list.length === 0
        ) {

            for (
                const a
                of doc.select("a")
            ) {

                const href =
                    a.attr("href") ||
                    "";


                const link =
                    this.absoluteUrl(
                        href
                    );


                const name =
                    this.cleanText(
                        a.text || ""
                    );


                if (
                    !name ||
                    !this.isNovelUrl(
                        link
                    ) ||
                    seen[link]
                ) {
                    continue;
                }


                seen[link] = true;


                let image =
                    this.imageUrl(a);


                if (!image) {

                    image =
                        await this.getNovelImage(
                            link
                        );
                }


                list.push({

                    name: name,

                    link: link,

                    imageUrl:
                        image
                });
            }
        }


        /*
         * Próxima página.
         */
        let hasNextPage =
            false;


        for (
            const a
            of doc.select("a")
        ) {

            const href =
                a.attr("href") ||
                "";


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

                text.includes("next") ||

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


    /*
     * -------------------------------------------------
     * PESQUISA
     * -------------------------------------------------
     */

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


        for (
            const a
            of doc.select("a")
        ) {

            const href =
                a.attr("href") ||
                "";


            const link =
                this.absoluteUrl(
                    href
                );


            const name =
                this.cleanText(
                    a.text || ""
                );


            if (
                !name ||
                !this.isNovelUrl(
                    link
                ) ||
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


            if (!image) {

                image =
                    await this.getNovelImage(
                        link
                    );
            }


            list.push({

                name: name,

                link: link,

                imageUrl:
                    image
            });
        }


        return {

            list: list,

            hasNextPage:
                false
        };
    }


    /*
     * -------------------------------------------------
     * DETALHES DA NOVEL
     * -------------------------------------------------
     */

    async getDetail(url) {

        const doc =
            await this.fetch(url);


        /*
         * Nome.
         */
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

            for (
                const selector
                of [

                    ".summary_content",

                    ".summary",

                    ".description",

                    ".entry-content",

                    "article"
                ]
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
                    text.length > 40
                ) {

                    description =
                        text;

                    break;
                }
            }
        }


        /*
         * Autor.
         */
        let author =
            "";


        for (
            const selector
            of [

                ".author-content",

                ".author",

                ".summary_content .author",

                ".summary-content .author"
            ]
        ) {

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
         * CAPA.
         */
        let image =
            this.getPageImage(
                doc
            );


        /*
         * CAPÍTULOS.
         */
        const chapters =
            this.extractChapters(
                doc
            );


        /*
         * Remove duplicados.
         */
        const unique =
            [];


        const chapterSeen =
            {};


        for (
            const chapter
            of chapters
        ) {

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


            unique.push(
                chapter
            );
        }


        return {

            name: name,

            link: url,

            imageUrl:
                image || "",

            description:
                description,

            author:
                author,

            genre: [
                "Novel",
                "BL",
                "PT-BR"
            ],

            status: 1,

            chapters:
                unique
        };
    }


    /*
     * -------------------------------------------------
     * CONTEÚDO DO CAPÍTULO
     * -------------------------------------------------
     *
     * Esta parte permanece compatível com
     * a versão que já estava funcionando.
     */

    async getHtmlContent(
        name,
        url
    ) {

        const doc =
            await this.fetch(url);


        /*
         * Procura primeiro os containers
         * específicos de leitura.
         */
        for (
            const selector
            of [

                ".reading-content",

                ".chapter-content",

                ".entry-content",

                ".post-content",

                "article .content",

                "article"
            ]
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
                    content.text ||
                    ""
                ).trim();


            if (
                text.length > 100
            ) {

                return content.outerHtml;
            }
        }


        /*
         * Fallback.
         */
        const body =
            doc.selectFirst(
                "body"
            );


        if (body) {

            const text =
                (
                    body.text ||
                    ""
                ).trim();


            if (
                text.length > 100
            ) {

                return body.outerHtml;
            }
        }


        throw new Error(
            "Não foi possível localizar o texto do capítulo no BL Novels."
        );
    }


    /*
     * -------------------------------------------------
     * LIMPEZA DO HTML
     * -------------------------------------------------
     */

    async cleanHtmlContent(
        html
    ) {

        const doc =
            new Document(
                html
            );


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

                "iframe",

                "form"
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
                ".reading-content"
            ) ||

            doc.selectFirst(
                ".chapter-content"
            ) ||

            doc.selectFirst(
                ".entry-content"
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
            "getFilterList not implemented."
        );
    }


    getSourcePreferences() {

        throw new Error(
            "getSourcePreferences not implemented."
        );
    }
}
