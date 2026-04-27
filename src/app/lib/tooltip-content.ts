/**
 * @fileOverview Centralized Tooltip Content Mapping
 * This file allows admins to update explanatory text for UI elements
 * without modifying the main component logic.
 */

export const TOOLTIP_CONTENT = {
    // Sidebar & Navigation
    nav_dashboard: "Ikhtisar operasional, grafik aktivitas, dan ringkasan piutang kritis.",
    nav_monitoring: "Pantau selisih (variansi) harga dan volume antara PO vs Realita penagihan.",
    nav_so: "Kelola pesanan dari customer dan hubungkan ke referensi PO sebelum penagihan.",
    nav_billing: "Daftar seluruh invoice yang telah diterbitkan (Commercial & Proforma).",
    nav_ar: "Buku piutang digital untuk rekonsiliasi pembayaran dan pelunasan.",
    nav_customers: "Database profil perusahaan pusat dan seluruh jaringan kantor cabang.",
    nav_catalog: "Daftar material master untuk standarisasi harga dan spesifikasi barang.",
    quick_add: "Shortcut Cepat: Daftarkan PO, SO, atau Customer baru dari halaman mana saja.",
    
    // Sales Order Modul
    missing_po: "Data SO ini belum terhubung dengan PO di Sales List. Klik 'Fix Mapping' untuk menghubungkan agar nilai tagihan akurat.",
    fix_mapping: "Hubungkan Sales Order ini ke Nomor PO Customer agar data penagihan tersinkronisasi.",
    so_constructor: "Modul untuk merakit rincian barang sesuai pesanan resmi customer.",
    
    // Invoice Modul
    update_master: "Centang jika Anda ingin perubahan nama atau alamat ini disimpan secara PERMANEN ke database Master Customer.",
    finalize_lock: "Kunci dokumen ini untuk audit. Data tidak akan bisa diubah kecuali oleh Leader/Super Admin.",
    void_invoice: "Batalkan invoice ini (VOID). Saldo akan dikembalikan ke plafon PO secara otomatis.",
    dp_mode: "Mode Down Payment: Tagihan awal sebelum barang dikirim (Uang Muka).",
    regular_billing: "Mode Penagihan Reguler: Tagihan berdasarkan pengiriman barang fisik.",
    tax_sync: "Sinkronisasi otomatis PPN 12% sesuai regulasi perpajakan terbaru.",
    back_to_list: "Klik untuk kembali ke daftar utama invoice.",
    
    // Sales Management (AR)
    outstanding_balance: "Total dana yang masih tertahan di customer dan belum masuk ke rekening perusahaan.",
    smart_checklist: "Gunakan ceklist untuk memilih banyak invoice sekaligus guna rekonsiliasi pembayaran massal.",
    payment_verify: "Konfirmasi bahwa dana telah benar-benar diterima di rekening bank/kas.",
    migration_adjustment: "Saldo pindahan dari sistem lama yang diakui secara manual sebagai saldo pembuka piutang.",

    // SPD Module
    create_spd: "Menerbitkan Surat Pengantar Dokumen (SPD) untuk konsolidasi pengiriman ke kurir.",
    spd_status_delivery: "Dokumen sedang dalam perjalanan menuju customer lewat kurir/ekspedisi.",
    spd_status_received: "Barang/Dokumen telah diterima dan ditandatangani oleh customer (Status Invoice akan otomatis berubah).",
    spd_status_rejected: "Pengiriman ditolak atau dokumen dikembalikan karena alasan operasional.",
    spd_quick_print: "Cetak ringkasan pengiriman (A4) sebagai bukti fisik tanda tangan basah.",
    spd_quick_share: "Salin link pelacakan digital untuk dibagikan via WhatsApp kepada customer.",
    spd_auto_pull: "Sistem otomatis menarik nomor Surat Jalan (SJ) dari data invoice terakhir.",
    spd_aging_alert: "Peringatan: Pengiriman ini sudah melebihi 5 hari di jalan. Segera cek status ke kurir."
} as const;

export type TooltipKey = keyof typeof TOOLTIP_CONTENT;
