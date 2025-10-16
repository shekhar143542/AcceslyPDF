/**
 * ===========================================
 * AI SERVICE - PHASE 3
 * ===========================================
 * 
 * Provides AI-powered functionality for accessibility fixes:
 * - Alt text generation using OpenAI GPT-4 Vision
 * - Color contrast analysis and suggestions
 * - Form field label generation
 * - Table structure detection
 */

// Configuration for AI providers
const AI_CONFIG = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4-vision-preview',
    maxTokens: 300,
  },
};

/**
 * Generate alt text for an image using AI
 */
export async function generateAltText(
  imageBuffer: Buffer,
  context?: string
): Promise<string> {
  console.log('🤖 [AI] Generating alt text for image...');
  
  try {
    // Check if OpenAI API key is configured
    if (!AI_CONFIG.openai.apiKey) {
      console.warn('⚠️ [AI] OpenAI API key not configured, using placeholder');
      return 'Image description (AI generation requires OpenAI API key)';
    }

    // Convert buffer to base64
    const base64Image = imageBuffer.toString('base64');
    const imageUrl = `data:image/png;base64,${base64Image}`;

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_CONFIG.openai.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an accessibility expert. Generate concise, descriptive alt text for images in PDF documents. Focus on what is important for understanding the document content. Keep descriptions under 125 characters when possible.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: context 
                  ? `Generate alt text for this image. Context: ${context}`
                  : 'Generate alt text for this image. Describe what is shown clearly and concisely.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                  detail: 'low', // Use low detail for faster/cheaper processing
                },
              },
            ],
          },
        ],
        max_tokens: AI_CONFIG.openai.maxTokens,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const altText = data.choices[0]?.message?.content?.trim();

    if (!altText) {
      throw new Error('No alt text generated');
    }

    console.log('✅ [AI] Alt text generated:', altText);
    return altText;

  } catch (error) {
    console.error('❌ [AI] Error generating alt text:', error);
    
    // Fallback to generic description
    return 'Image in document (automatic description failed)';
  }
}

/**
 * Analyze color contrast and suggest improvements
 */
export async function analyzeColorContrast(
  foregroundColor: { r: number; g: number; b: number },
  backgroundColor: { r: number; g: number; b: number },
  fontSize: number = 12
): Promise<{
  ratio: number;
  passes: {
    aa: boolean;
    aaa: boolean;
  };
  suggestion?: {
    foreground: { r: number; g: number; b: number };
    background: { r: number; g: number; b: number };
    ratio: number;
  };
}> {
  console.log('🎨 [AI] Analyzing color contrast...');

  // Calculate relative luminance
  const getLuminance = (color: { r: number; g: number; b: number }) => {
    const [r, g, b] = [color.r, color.g, color.b].map((val) => {
      const sRGB = val / 255;
      return sRGB <= 0.03928
        ? sRGB / 12.92
        : Math.pow((sRGB + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  // Calculate contrast ratio
  const l1 = getLuminance(foregroundColor);
  const l2 = getLuminance(backgroundColor);
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

  // WCAG requirements
  const isLargeText = fontSize >= 18 || (fontSize >= 14 && true); // Bold
  const aaRequirement = isLargeText ? 3.0 : 4.5;
  const aaaRequirement = isLargeText ? 4.5 : 7.0;

  const passes = {
    aa: ratio >= aaRequirement,
    aaa: ratio >= aaaRequirement,
  };

  console.log(`📊 [AI] Contrast ratio: ${ratio.toFixed(2)}:1`);
  console.log(`✅ [AI] WCAG AA: ${passes.aa ? 'PASS' : 'FAIL'}`);
  console.log(`✅ [AI] WCAG AAA: ${passes.aaa ? 'PASS' : 'FAIL'}`);

  // Generate suggestion if doesn't pass AA
  let suggestion;
  if (!passes.aa) {
    // Simple suggestion: darken foreground or lighten background
    const targetRatio = aaRequirement + 0.5; // Add buffer
    
    // Darken foreground
    const darkened = {
      r: Math.max(0, foregroundColor.r - 50),
      g: Math.max(0, foregroundColor.g - 50),
      b: Math.max(0, foregroundColor.b - 50),
    };

    const newL1 = getLuminance(darkened);
    const newRatio = (Math.max(newL1, l2) + 0.05) / (Math.min(newL1, l2) + 0.05);

    suggestion = {
      foreground: darkened,
      background: backgroundColor,
      ratio: newRatio,
    };

    console.log(`💡 [AI] Suggestion: Change foreground to RGB(${darkened.r}, ${darkened.g}, ${darkened.b})`);
    console.log(`💡 [AI] New ratio: ${newRatio.toFixed(2)}:1`);
  }

  return { ratio, passes, suggestion };
}

/**
 * Generate contextual labels for form fields using AI
 */
export async function generateFormFieldLabels(
  fields: Array<{
    name: string;
    type: string;
    value?: string;
    position: { x: number; y: number };
  }>,
  context?: string
): Promise<Array<{ fieldName: string; suggestedLabel: string }>> {
  console.log('📝 [AI] Generating form field labels...');

  try {
    if (!AI_CONFIG.openai.apiKey) {
      console.warn('⚠️ [AI] OpenAI API key not configured');
      return fields.map((field) => ({
        fieldName: field.name,
        suggestedLabel: field.name || 'Field',
      }));
    }

    // Prepare field descriptions
    const fieldDescriptions = fields
      .map((f) => `- ${f.name || 'unnamed'} (${f.type})`)
      .join('\n');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_CONFIG.openai.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an accessibility expert. Generate clear, concise labels for form fields based on their names and types. Labels should be user-friendly and descriptive.',
          },
          {
            role: 'user',
            content: `Generate accessible labels for these form fields:\n${fieldDescriptions}\n\nContext: ${context || 'General form'}\n\nReturn as JSON array: [{"fieldName": "...", "suggestedLabel": "..."}]`,
          },
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content?.trim();

    // Parse JSON response
    const labels = JSON.parse(content);
    console.log('✅ [AI] Generated labels for', labels.length, 'fields');

    return labels;

  } catch (error) {
    console.error('❌ [AI] Error generating labels:', error);
    
    // Fallback to field names
    return fields.map((field) => ({
      fieldName: field.name,
      suggestedLabel: field.name || 'Input Field',
    }));
  }
}

/**
 * Detect table structure using AI
 */
export async function detectTableStructure(
  tableData: string[][]
): Promise<{
  hasHeaders: boolean;
  headerRow?: number;
  headerCols?: number[];
  structure: 'simple' | 'complex';
}> {
  console.log('📊 [AI] Detecting table structure...');

  // Simple heuristic analysis
  if (!tableData || tableData.length === 0) {
    return { hasHeaders: false, structure: 'simple' };
  }

  // Check first row - likely headers if:
  // 1. Different from other rows
  // 2. Contains text (not numbers)
  // 3. Shorter/different format
  const firstRow = tableData[0];
  const hasTextHeader = firstRow.some((cell) => isNaN(Number(cell)));
  const isDifferent = tableData.length > 1 && 
    JSON.stringify(firstRow) !== JSON.stringify(tableData[1]);

  const hasHeaders = hasTextHeader && isDifferent;
  const structure = tableData.length > 10 || tableData[0]?.length > 5 
    ? 'complex' 
    : 'simple';

  console.log('✅ [AI] Table analysis:', {
    hasHeaders,
    rows: tableData.length,
    cols: firstRow.length,
    structure,
  });

  return {
    hasHeaders,
    headerRow: hasHeaders ? 0 : undefined,
    structure,
  };
}

/**
 * Batch process multiple images for alt text
 */
export async function batchGenerateAltText(
  images: Array<{ id: string; buffer: Buffer; context?: string }>
): Promise<Array<{ id: string; altText: string }>> {
  console.log(`🤖 [AI] Batch generating alt text for ${images.length} images...`);

  const results = await Promise.all(
    images.map(async (image) => {
      try {
        const altText = await generateAltText(image.buffer, image.context);
        return { id: image.id, altText };
      } catch (error) {
        console.error(`❌ [AI] Failed to generate alt text for ${image.id}:`, error);
        return { id: image.id, altText: 'Image description unavailable' };
      }
    })
  );

  console.log(`✅ [AI] Batch completed: ${results.length} alt texts generated`);
  return results;
}

/**
 * Estimate AI processing cost
 */
export function estimateAICost(operationType: 'altText' | 'formLabels', count: number): number {
  const costs = {
    altText: 0.02,      // $0.02 per image with GPT-4 Vision
    formLabels: 0.001,  // $0.001 per field with GPT-4
  };

  const estimatedCost = costs[operationType] * count;
  console.log(`💰 [AI] Estimated cost for ${count} ${operationType}: $${estimatedCost.toFixed(4)}`);
  
  return estimatedCost;
}
