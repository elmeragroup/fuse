"use client";

import { Link } from "@elmeragroup/fuse/link";
import { Text } from "@elmeragroup/fuse/text";

export function LinkBasic() {
  return (
    <Text className="max-w-md">
      Read the <Link href="#terms-of-delivery">terms of delivery</Link> before you confirm the order.
    </Text>
  );
}
