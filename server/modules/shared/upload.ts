import multer from "multer";
import path from "path";
import fs from "fs";

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure storage for invoice uploads
const invoiceStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    // Generate unique filename while preserving extension
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `invoice-${timestamp}-${random}${ext}`);
  }
});

// Configure storage for product/general image uploads
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    // Generate unique filename while preserving extension
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `product-${timestamp}-${random}${ext}`);
  }
});

export const upload = multer({
  storage: invoiceStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Accept images only
    const allowedTypes = /jpeg|jpg|png|gif|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files (JPEG, JPG, PNG, GIF) and PDF are allowed!"));
    }
  }
});

export const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Accept images only (no PDF for product images)
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files (JPEG, JPG, PNG, GIF, WebP) are allowed!"));
    }
  }
});

// Configure storage for CSV/Excel uploads
const dataFileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    // Generate unique filename while preserving extension
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const ext = path.extname(file.originalname);
    cb(null, `upload-${timestamp}-${random}${ext}`);
  }
});

export const dataFileUpload = multer({
  storage: dataFileStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Accept CSV and Excel files
    const allowedTypes = /csv|xls|xlsx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const allowedMimeTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/csv',
      'text/plain'
    ];
    const mimetype = allowedMimeTypes.includes(file.mimetype);
    
    if (mimetype || extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only CSV and Excel files (.csv, .xls, .xlsx) are allowed!"));
    }
  }
});
