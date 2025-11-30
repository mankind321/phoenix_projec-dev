"use client";

import Image from "next/image";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

export default function PropertyImageCarousel({
  images,
}: {
  images: { file_url: string | null }[];
}) {
  const validImages = images.filter((img) => img.file_url);

  if (validImages.length === 0) {
    return (
      <div className="w-full h-56 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500">
        No Images
      </div>
    );
  }

  return (
    <Carousel className="w-full max-w-xl mx-auto">
      <CarouselContent>
        {validImages.map((image, index) => (
          <CarouselItem key={index}>
            <div className="p-1">
              <div className="relative w-full h-60 sm:h-72 md:h-80 rounded-xl overflow-hidden">
                <Image
                  src={image.file_url!}
                  alt={`Property Image ${index}`}
                  fill
                  className="object-cover"
                  sizes="100vw"
                />
              </div>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>

      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  );
}