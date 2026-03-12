import mongoose from 'mongoose';
import Cart    from '../../models/Cart.js';
import Product from '../../models/Product.js';


const SHIPPING_FEE  = 5;
const FREE_SHIPPING = 500; // free shipping above this subtotal



export const getCart = async (req, res) => {

    if (!req.session?.user?.id) return res.redirect('/login');

    try {
        const cart = await Cart.findOne({ userId: req.session.user.id })
            .populate({
                path:   'items.productId',
                select: 'productName imageUrl price categoryId stockQuantity outOfstock isActive',
                populate: { path: 'categoryId', select: 'categoryName' },
            })
            .lean();


        const cartItems = (cart?.items || [])
            .filter(i => i.productId)
            .map(i => ({
                _id:        i.productId._id.toString(),
                name:       i.productId.productName,
                image:      i.productId.imageUrl || '',
                price:      i.productId.price,
                category:   i.productId.categoryId?.categoryName || '',
                quantity:   i.quantity,
                stock:      i.productId.stockQuantity,
                outOfstock: i.productId.outOfstock,
                lineTotal:  +(i.productId.price * i.quantity).toFixed(2),
            }));

        const subtotal = +cartItems.reduce((sum, i) => sum + i.lineTotal, 0).toFixed(2);
        const shipping = cartItems.length === 0 ? 0 : subtotal >= FREE_SHIPPING ? 0 : SHIPPING_FEE;
        const total    = +(subtotal + shipping).toFixed(2);

        res.render('user/cart', {
            title:     'Your Cart',
            cartItems,
            subtotal,
            shipping,
            total,
            itemCount: cartItems.reduce((n, i) => n + i.quantity, 0),
            success:   req.query.success || null,
            error:     req.query.error   || null,
        });

    } catch (err) {
        console.error('getCart error:', err.message);
        res.render('user/cart', {
            title:     'Your Cart',
            cartItems: [],
            subtotal:  0,
            shipping:  0,
            total:     0,
            itemCount: 0,
            success:   null,
            error:     'Failed to load cart.',
        });
    }
};



export const addToCart = async (req, res) => {

    if (!req.session?.user?.id) return res.redirect('/login');

    const { productId } = req.params;
    const userId = req.session.user.id;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.redirect('/cart?error=Invalid+product');
    }

    try {
        const product = await Product.findById(productId).lean();
        if (!product)           return res.redirect('/cart?error=Product+not+found');
        if (product.outOfstock) return res.redirect('/cart?error=Product+is+out+of+stock');

        const cart = await Cart.findOne({ userId });

        if (cart) {
            const existing = cart.items.find(i => i.productId.toString() === productId);
            if (existing) {
                // cap at available stock
                if (existing.quantity < product.stockQuantity) {
                    existing.quantity += 1;
                }
            } else {
                cart.items.push({ productId });
            }
            await cart.save();
        } else {
            await Cart.create({ userId, items: [{ productId }] });
        }

        const back = req.headers.referer || '/cart';
        return res.redirect(back + (back.includes('?') ? '&' : '?') + 'added=1');

    } catch (err) {
        console.error('addToCart error:', err.message);
        return res.redirect('/cart?error=Failed+to+add+to+cart');
    }
};



export const updateCartItem = async (req, res) => {

    if (!req.session?.user?.id) return res.redirect('/login');

    const { productId } = req.params;
    const qty = parseInt(req.body.quantity, 10);

    if (!mongoose.Types.ObjectId.isValid(productId) || isNaN(qty) || qty < 1) {
        return res.redirect('/cart?error=Invalid+quantity');
    }

    try {
        const product = await Product.findById(productId).lean();
        const safeQty = product ? Math.min(qty, product.stockQuantity) : qty;

        await Cart.findOneAndUpdate(
            { userId: req.session.user.id, 'items.productId': productId },
            { $set: { 'items.$.quantity': safeQty } }
        );

        return res.redirect('/cart');

    } catch (err) {
        console.error('updateCartItem error:', err.message);
        return res.redirect('/cart?error=Failed+to+update+quantity');
    }
};



export const removeFromCart = async (req, res) => {

    if (!req.session?.user?.id) return res.redirect('/login');

    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.redirect('/cart?error=Invalid+product');
    }

    try {
        await Cart.findOneAndUpdate(
            { userId: req.session.user.id },
            { $pull: { items: { productId } } }
        );

        return res.redirect('/cart?success=Item+removed');

    } catch (err) {
        console.error('removeFromCart error:', err.message);
        return res.redirect('/cart?error=Failed+to+remove+item');
    }
};
