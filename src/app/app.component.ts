import {
  Component,
  ElementRef,
  ViewChild,
  OnInit,
  NgZone,
} from "@angular/core";
import * as pdfjsLib from "pdfjs-dist";
import { FILE_BASE_64 } from "../shared/model/file.interface";

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  @ViewChild("pdfContainer", { static: true })
  pdfContainer!: ElementRef<HTMLDivElement>;

  pdfDocument: any;
  totalPages = 0;
  currentPage = 1;
  scale = 1.5;

  observer!: IntersectionObserver;
  renderedPages: Set<number> = new Set();
  renderHistory: number[] = [];
  pageElements: Map<number, HTMLDivElement> = new Map();

  constructor(private ngZone: NgZone) {}

  async ngOnInit(): Promise<void> {
    window.addEventListener("resize", () => {
      location.reload();
    });

    //this.scale = this.getResponsiveScale();

    const pdfjs = pdfjsLib as any;
    pdfjs.GlobalWorkerOptions.workerSrc = "/assets/pdf.worker.min.mjs";

    const binary = this.base64ToUint8Array(FILE_BASE_64);
    const loadingTask = pdfjs.getDocument({ data: binary });

    this.pdfDocument = await loadingTask.promise;
    this.totalPages = this.pdfDocument.numPages;

    this.setupScrollTracking();
    this.createPlaceholdersAndObserve();
  }

  getResponsiveScale(): number {
    const width = window.innerWidth;
  
    if (width >= 1200) return 1.5;   // tablets grandes ou modo desktop
    if (width >= 768) return 1.2;    // tablets pequenos
    return 0.9;                      // celulares
  }


  createPlaceholdersAndObserve() {
    const container = this.pdfContainer.nativeElement;

    for (let i = 1; i <= this.totalPages; i++) {
      const wrapper = document.createElement("div");
      wrapper.dataset['page'] = i.toString();
      wrapper.style.minHeight = "calc(100vw * 1.3)"; // proporcional à largura da tela
      wrapper.style.marginBottom = i == this.totalPages ? "0px": "0,1vh";
      wrapper.style.display = "flex";
      wrapper.style.justifyContent = "center";

      container.appendChild(wrapper);
      this.pageElements.set(i, wrapper);
      this.observer.observe(wrapper);
    }
  }

  setupScrollTracking() {
    this.ngZone.runOutsideAngular(() => {
      this.observer = new IntersectionObserver(
        (entries) => {
          const visiblePages = new Set<number>();

          entries.forEach((entry) => {
            const page = parseInt(entry.target.getAttribute("data-page")!, 10);

            if (entry.isIntersecting) {
              visiblePages.add(page);

              this.ngZone.run(() => {
                this.currentPage = page;
              });

              if (!this.renderedPages.has(page)) {
                this.renderPage(page, entry.target as HTMLDivElement);
              }
            }
          });

          // Pré-renderiza anterior e próxima
          visiblePages.forEach((page) => {
            [page - 1, page + 1].forEach((p) => {
              if (p >= 1 && p <= this.totalPages && !this.renderedPages.has(p)) {
                const el = this.pageElements.get(p);
                if (el) this.renderPage(p, el);
              }
            });
          });
        },
        {
          root: null,
          rootMargin: "400px 0px",
          threshold: 0.1,
        }
      );
    });
  }

  base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  async renderPage(pageNumber: number, container: HTMLDivElement) {
    try {
      const page = await this.pdfDocument.getPage(pageNumber);
      const outputScale = window.devicePixelRatio || 1;

      const viewport = page.getViewport({ scale: this.scale * outputScale });

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d")!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      canvas.style.maxWidth = "95%";
      canvas.style.height = "auto";
      canvas.style.marginBottom = "1vh";
      canvas.style.marginTop = "1vh";

      context.setTransform(outputScale, 0, 0, outputScale, 0, 0);

      container.innerHTML = "";
      container.appendChild(canvas);

      const renderContext = {
        canvasContext: context,
        viewport: page.getViewport({ scale: this.scale }),
      };

      await page.render(renderContext).promise;
      this.renderedPages.add(pageNumber);
      this.renderHistory.push(pageNumber);

      // Limita a 6 páginas na memória
      if (this.renderHistory.length > 6) {
        const oldest = this.renderHistory.shift();
        if (oldest !== undefined && this.renderedPages.has(oldest)) {
          const el = this.pageElements.get(oldest);
          if (el) el.innerHTML = "";
          this.renderedPages.delete(oldest);
        }
      }
    } catch (error) {
      console.error(`Erro ao renderizar página ${pageNumber}:`, error);
    }
  }
}
