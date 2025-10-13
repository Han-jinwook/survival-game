"use client"

import dynamic from "next/dynamic"

const AdminContent = dynamic(() => import("./admin-content"), { ssr: false })

export default function AdminPage() {
  return <AdminContent />
}
