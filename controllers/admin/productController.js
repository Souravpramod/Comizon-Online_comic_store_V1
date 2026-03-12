import Product from '../../models/Product.js';
import Category from '../../models/Category.js';
import cloudinary from '../../config/cloudinary.js';
import { uploadToCloudinary } from '../../middlewares/admin/upload.js';

const ITEMS_PER_PAGE = 10;



export const getProducts = async (req, res) => {
    const { search = '', category = '', status = '', sort = 'newest', page = 1 } = req.query;
    const currentPage = Number(page);

    try {
        const query = {};

        const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        if (search) {
            const safeSearch = escapeRegex(search);

            query.$or = [
                { productName: { $regex: safeSearch, $options: 'i' } },
                { author: { $regex: safeSearch, $options: 'i' } },
                { sku: { $regex: safeSearch, $options: 'i' } }
            ];
        };

        // Bug 3 Fixed: Removed dead Category.findOne lookup. Template already sends cat._id as value.
        if (category) query.categoryId = category;

        if (status === 'instock')    query.stockQuantity = { $gt: 10 };
        if (status === 'lowstock')   query.stockQuantity = { $gte: 1, $lte: 10 };
        if (status === 'outofstock') query.outOfstock = true;

        const sortOption =
            sort === 'name_asc'   ? { productName: 1 }   :
            sort === 'price_asc'  ? { price: 1 }          :
            sort === 'price_desc' ? { price: -1 }         :
            sort === 'stock'      ? { stockQuantity: -1 } :
                                    { createdAt: -1 };

        const totalProducts = await Product.countDocuments(query);
        const products = await Product.find(query)
            .populate('categoryId', 'categoryName')
            .sort(sortOption)
            .skip((currentPage - 1) * ITEMS_PER_PAGE)
            .limit(ITEMS_PER_PAGE)
            .lean();

        const categories = await Category.find({ isActive: true }).lean();

        res.render('admin/products/index', {
            title: 'Product Management',
            products,
            categories,
            totalProducts,
            totalPages:  Math.ceil(totalProducts / ITEMS_PER_PAGE),
            currentPage,
            search, category, status, sort,
            error:   req.query.error   || null,
            success: req.query.success || null,
        });

    } catch (err) {
        console.error('getProducts error:', err.message);
        const categories = await Category.find({ isActive: true }).lean().catch(() => []);
        res.render('admin/products/index', {
            title: 'Product Management',
            products: [], categories, totalProducts: 0, totalPages: 1, currentPage: 1,
            search: '', category: '', status: '', sort: 'newest',
            error: 'Failed to load products', success: null,
        });
    }
};



export const addProduct = async (req, res) => {
    try {

        const {
            productName, author, publisher,
            categoryId, price, stockQuantity,
            description, isPremium
        } = req.body;

        // Bug 2 Fixed: Guard against undefined productName (e.g. missing enctype on form)
        if (!productName) {
            return res.redirect('/admin/products?error=Product+name+is+required');
        }

        let imageUrl = '';
        if (req.file && req.file.buffer) {
            imageUrl = await uploadToCloudinary(req.file.buffer);
        }

        const qty = parseInt(stockQuantity, 10) || 0;
        const sku = `PRD-${Date.now().toString().slice(-6)}`;

        await Product.create({
            categoryId,
            productName:   productName.trim(),
            author:        author      || '',
            publisher:     publisher   || '',
            description:   description || '',
            price:         parseFloat(price),
            stockQuantity: qty,
            imageUrl,
            isPremium:     isPremium === 'true',
            outOfstock:    qty === 0,
            sku,
        });

        // Bug 4 Fixed: Encoded spaces in redirect URL
        res.redirect('/admin/products?success=Product+added+successfully');

    } catch (err) {
        console.error('addProduct error:', err);
        res.redirect(`/admin/products?error=${encodeURIComponent(err.message)}`);
    }
};



export const getEditProduct = async (req, res) => {
    try {
        const product    = await Product.findById(req.params.id).lean();
        const categories = await Category.find({ isActive: true }).lean();

        if (!product) return res.redirect('/admin/products?error=Product+not+found');

        res.render('admin/products/edit', {
            title: 'Edit Product',
            product,
            categories,
            error:   req.query.error   || null,
            success: req.query.success || null,
        });

    } catch (err) {
        console.error('getEditProduct error:', err.message);
        res.redirect('/admin/products?error=Failed+to+load+product');
    }
};



export const updateProduct = async (req, res) => {
    try {

        const {
            productName, author, publisher,
            categoryId, price, stockQuantity,
            description, isPremium
        } = req.body;

        const product = await Product.findById(req.params.id);
        if (!product) return res.redirect('/admin/products?error=Product+not+found');

        if (req.file && req.file.buffer) {
            if (product.imageUrl) {
                const urlParts = product.imageUrl.split('/');
                const filename = urlParts[urlParts.length - 1].split('.')[0];
                const publicId = `comizon/products/${filename}`;
                await cloudinary.uploader.destroy(publicId).catch((e) => {
                    console.warn('Cloudinary destroy warning:', e.message);
                });
            }
            product.imageUrl = await uploadToCloudinary(req.file.buffer);
        }

        const qty = parseInt(stockQuantity, 10) || 0;
        product.productName   = productName.trim();
        product.author        = author      || '';
        product.publisher     = publisher   || '';
        product.categoryId    = categoryId;
        product.price         = parseFloat(price);
        product.stockQuantity = qty;
        product.description   = description || '';
        product.isPremium     = isPremium === 'true';
        product.outOfstock    = qty === 0;

        await product.save();

        // Bug 5 Fixed: Encoded spaces in redirect URL
        res.redirect('/admin/products?success=Product+updated+successfully');

    } catch (err) {
        console.error('updateProduct error:', err.message);
        res.redirect(`/admin/products/edit/${req.params.id}?error=${encodeURIComponent(err.message)}`);
    }
};



export const deleteProduct = async (req, res) => {
    try {

        const product = await Product.findById(req.params.id);
        if (!product) return res.redirect('/admin/products?error=Product+not+found');

        product.isActive = false;
        await product.save();


        res.redirect('/admin/products?success=Product+deactivated+successfully');

    } catch (err) {
        console.error('deleteProduct error:', err.message);
        res.redirect('/admin/products?error=Failed+to+deactivate+product');
    }
};

export const activateProduct = async (req, res) => {
    try {
        await Product.findByIdAndUpdate(req.params.id, { isActive: true });
        res.redirect('/admin/products?success=Product+activated');
    } catch (err) {
        res.redirect('/admin/products?error=Failed+to+activate');
    }
};