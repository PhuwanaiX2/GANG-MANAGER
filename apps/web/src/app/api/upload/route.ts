
import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const url = formData.get('url') as string | null;
        const folder = formData.get('folder') as string || 'gangs'; // Default folder

        // Case 1: Upload from local file
        if (file) {
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            const result = await new Promise((resolve, reject) => {
                cloudinary.uploader.upload_stream(
                    { folder: folder },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result);
                    }
                ).end(buffer);
            });

            return NextResponse.json(result);
        }

        // Case 2: Upload from URL (e.g., Discord CDN)
        if (url) {
            const result = await cloudinary.uploader.upload(url, {
                folder: folder,
            });
            return NextResponse.json(result);
        }

        return NextResponse.json(
            { error: 'No file or URL provided' },
            { status: 400 }
        );

    } catch (error: any) {
        console.error('Upload error:', error);
        return NextResponse.json(
            { error: error.message || 'Upload failed' },
            { status: 500 }
        );
    }
}
