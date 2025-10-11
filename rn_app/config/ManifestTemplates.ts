import { ManifestTemplate } from '../types';

// Default HLS VOD template
export const HLS_VOD_TEMPLATE: ManifestTemplate = {
  version: '3',
  targetDuration: 10,
  mediaSequence: 0,
  playlistType: 'VOD',
  template: `#EXTM3U
#EXT-X-VERSION:{{version}}
#EXT-X-TARGETDURATION:{{targetDuration}}
#EXT-X-MEDIA-SEQUENCE:{{mediaSequence}}
#EXT-X-PLAYLIST-TYPE:{{playlistType}}
{{segments}}
#EXT-X-ENDLIST`
};

// HLS Event template (for live-like content)
export const HLS_EVENT_TEMPLATE: ManifestTemplate = {
  version: '3',
  targetDuration: 10,
  mediaSequence: 0,
  playlistType: 'EVENT',
  template: `#EXTM3U
#EXT-X-VERSION:{{version}}
#EXT-X-TARGETDURATION:{{targetDuration}}
#EXT-X-MEDIA-SEQUENCE:{{mediaSequence}}
#EXT-X-PLAYLIST-TYPE:{{playlistType}}
{{segments}}`
};

// HLS Live template (no end list)
export const HLS_LIVE_TEMPLATE: ManifestTemplate = {
  version: '3',
  targetDuration: 10,
  mediaSequence: 0,
  playlistType: 'EVENT',
  template: `#EXTM3U
#EXT-X-VERSION:{{version}}
#EXT-X-TARGETDURATION:{{targetDuration}}
#EXT-X-MEDIA-SEQUENCE:{{mediaSequence}}
{{segments}}`
};

// Template registry
export const TEMPLATE_REGISTRY: Record<string, ManifestTemplate> = {
  'hls-vod-v3': HLS_VOD_TEMPLATE,
  'hls-event-v3': HLS_EVENT_TEMPLATE,
  'hls-live-v3': HLS_LIVE_TEMPLATE,
};

// Template manager class
export class ManifestTemplateManager {
  private templates = new Map<string, ManifestTemplate>();
  private serverTemplates = new Map<string, ManifestTemplate>();

  constructor() {
    // Initialize with default templates
    this.loadDefaultTemplates();
  }

  /**
   * Load default templates
   */
  private loadDefaultTemplates(): void {
    Object.entries(TEMPLATE_REGISTRY).forEach(([id, template]) => {
      this.templates.set(id, template);
    });
  }

  /**
   * Get template by ID
   */
  getTemplate(templateId: string): ManifestTemplate | undefined {
    return this.templates.get(templateId) || this.serverTemplates.get(templateId);
  }

  /**
   * Fetch template from server
   */
  async fetchTemplate(templateId: string, serverUrl?: string): Promise<ManifestTemplate | null> {
    try {
      const url = serverUrl || `https://api.example.com/templates/${templateId}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        console.warn(`Failed to fetch template ${templateId}: ${response.status}`);
        return null;
      }

      const templateData = await response.json();
      const template: ManifestTemplate = {
        version: templateData.version || '3',
        targetDuration: templateData.targetDuration || 10,
        mediaSequence: templateData.mediaSequence || 0,
        playlistType: templateData.playlistType || 'VOD',
        template: templateData.template,
      };

      // Store in server templates
      this.serverTemplates.set(templateId, template);
      
      console.log(`Fetched template ${templateId} from server`);
      return template;
    } catch (error) {
      console.error(`Failed to fetch template ${templateId}:`, error);
      return null;
    }
  }

  /**
   * Update template locally
   */
  updateTemplate(templateId: string, template: ManifestTemplate): void {
    this.templates.set(templateId, template);
  }

  /**
   * Generate manifest from template
   */
  generateManifest(
    templateId: string,
    segments: Array<{ url: string; duration: number; sequence: number }>,
    overrides?: Partial<ManifestTemplate>
  ): string {
    const template = this.getTemplate(templateId);
    if (!template) {
      console.warn(`Template ${templateId} not found, using default`);
      return this.generateDefaultManifest(segments);
    }

    // Apply overrides
    const finalTemplate = { ...template, ...overrides };

    // Render template
    let manifest = finalTemplate.template;
    
    // Replace placeholders
    manifest = manifest.replace(/\{\{version\}\}/g, finalTemplate.version);
    manifest = manifest.replace(/\{\{targetDuration\}\}/g, finalTemplate.targetDuration.toString());
    manifest = manifest.replace(/\{\{mediaSequence\}\}/g, finalTemplate.mediaSequence.toString());
    manifest = manifest.replace(/\{\{playlistType\}\}/g, finalTemplate.playlistType);

    // Generate segments
    const segmentLines = segments
      .map(segment => `#EXTINF:${segment.duration},\n${segment.url}`)
      .join('\n');

    manifest = manifest.replace(/\{\{segments\}\}/g, segmentLines);

    return manifest;
  }

  /**
   * Generate default manifest (fallback)
   */
  private generateDefaultManifest(
    segments: Array<{ url: string; duration: number; sequence: number }>
  ): string {
    let manifest = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:VOD

`;

    segments.forEach(segment => {
      manifest += `#EXTINF:${segment.duration},\n${segment.url}\n`;
    });

    manifest += '#EXT-X-ENDLIST\n';
    return manifest;
  }

  /**
   * Get all available template IDs
   */
  getAvailableTemplates(): string[] {
    return [
      ...Array.from(this.templates.keys()),
      ...Array.from(this.serverTemplates.keys()),
    ];
  }

  /**
   * Validate template
   */
  validateTemplate(template: ManifestTemplate): boolean {
    return !!(
      template.version &&
      template.targetDuration &&
      template.mediaSequence !== undefined &&
      template.playlistType &&
      template.template
    );
  }

  /**
   * Clear server templates
   */
  clearServerTemplates(): void {
    this.serverTemplates.clear();
  }

  /**
   * Get template statistics
   */
  getTemplateStats(): {
    localTemplates: number;
    serverTemplates: number;
    totalTemplates: number;
  } {
    return {
      localTemplates: this.templates.size,
      serverTemplates: this.serverTemplates.size,
      totalTemplates: this.templates.size + this.serverTemplates.size,
    };
  }
}

export default new ManifestTemplateManager();

