const mangayomiSources = [{
    "name": "BR Yaoi - Novels",
    "lang": "pt",
    "baseUrl": "https://bryaoi.com",
    "apiUrl": "",
    "iconUrl": "https://bryaoi.com/favicon.ico",
    "typeSource": "single",
    "itemType": 2,
    "version": "0.1.6",
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

        const last =
            parts[parts.length - 1];

        const url =
            last.split(/\s+/)[0];

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
         * Open Graph / Twitter.
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
         * image_src.
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
         * Seletores comuns de WordPress.
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
         * Último recurso.
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
     * Verifica se o link é de capítulo.
     *
     * Aceita qualquer link /ler/, incluindo:
     * Capítulo
     * Side Story
     * Extra
     * Prólogo
     * etc.
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

        return true;
    }


    /*
     * Extrai capítulos.
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


            if (text.length > 200) {
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
         * Próxima página.
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
         * NOME
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
         * ==================================================
         * SINOPSE
         * ==================================================
         *
         * O BR Yaoi coloca a sinopse no conteúdo da página
         * depois de "SINOPSE:".
         *
         * Exemplo:
         *
         * SINOPSE:
         * Texto da sinopse...
         *
         * Nome alternativo:
         *
         * A extração abaixo procura primeiro por uma
         * ocorrência de "SINOPSE:" dentro de um parágrafo.
         *
         * Depois, caso "SINOPSE" esteja sozinho em um
         * parágrafo, pega os parágrafos seguintes.
         */

        let description = "";


        const paragraphs =
            doc.select("p");


        /*
         * PRIMEIRO MÉTODO:
         *
         * Procura "sinopse:" no próprio texto.
         */
        for (const p of paragraphs) {

            const text =
                this.cleanText(
                    p.text || ""
                );

            if (!text) {
                continue;
            }


            const lower =
                text.toLowerCase();


            const pos =
                lower.indexOf(
                    "sinopse:"
                );


            if (pos >= 0) {

                const value =
                    text.substring(
                        pos +
                        "sinopse:".length
                    ).trim();


                if (value.length > 30) {

                    description =
                        value;

                    break;
                }
            }
        }


        /*
         * SEGUNDO MÉTODO:
         *
         * Caso "SINOPSE" esteja em um parágrafo
         * separado, procura o próximo conteúdo.
         */
        if (!description) {

            let foundSinopse =
                false;


            for (const p of paragraphs) {

                const text =
                    this.cleanText(
                        p.text || ""
                    );

                if (!text) {
                    continue;
                }


                const lower =
                    text.toLowerCase();


                if (
                    lower === "sinopse" ||
                    lower === "sinopse:"
                ) {

                    foundSinopse = true;
                    continue;
                }


                if (!foundSinopse) {
                    continue;
                }


                /*
                 * A sinopse termina antes
                 * de "Nome alternativo".
                 */
                if (
                    lower.indexOf(
                        "nome alternativo"
                    ) === 0
                ) {
                    break;
                }


                /*
                 * Ignora textos muito pequenos,
                 * como títulos ou separadores.
                 */
                if (text.length > 30) {

                    description =
                        text;

                    break;
                }
            }
        }


        /*
         * TERCEIRO MÉTODO:
         *
         * Algumas páginas podem ter a sinopse
         * junto com outros elementos.
         *
         * Aqui procuramos qualquer elemento de
         * texto que contenha "SINOPSE:".
         */
        if (!description) {

            const elements =
                doc.select(
                    "h1, h2, h3, h4, h5, h6, div, section"
                );


            for (const element of elements) {

                const text =
                    this.cleanText(
                        element.text || ""
                    );

                if (!text) {
                    continue;
                }


                const lower =
                    text.toLowerCase();


                const pos =
                    lower.indexOf(
                        "sinopse:"
                    );


                if (pos < 0) {
                    continue;
                }


                let value =
                    text.substring(
                        pos +
                        "sinopse:".length
                    ).trim();


                /*
                 * Se o elemento também contém
                 * "Nome alternativo", corta antes dele.
                 */
                const alternativePos =
                    value.toLowerCase()
                        .indexOf(
                            "nome alternativo"
                        );


                if (alternativePos >= 0) {

                    value =
                        value.substring(
                            0,
                            alternativePos
                        ).trim();
                }


                if (value.length > 30) {

                    description =
                        value;

                    break;
                }
            }
        }


        /*
         * ÚLTIMO RECURSO:
         * meta description.
         */
        if (!description) {

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
        }


        /*
         * CAPA
         */
        const coverUrl =
            this.getPageImage(doc);


        /*
         * AUTOR
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
         * Qualquer link /ler/ é considerado
         * um possível capítulo.
         */
        let chapters =
            this.extractChapters(
                doc
            );


        /*
         * Remove duplicados.
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
