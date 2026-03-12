import Category from '../../models/Category.js';
import Product from '../../models/Product.js';

const ITEMS_PER_PAGE = 6;


export const getCategories = async (req, res) => {
    const currentPage = Number(req.query.page) || 1;
    const search = req.query.search || '';
    const status = req.query.status || '';

    try {
        const totalCategories  = await Category.countDocuments();
        const activeCategories = await Category.countDocuments({ isActive: true });
        const featuredCount    = await Category.countDocuments({ isPremium: true });
        const totalProducts    = await Product.countDocuments();

        
        const query = {};

        if (search) {
            const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            query.$or = [
                { categoryName: { $regex: escapeRegex(search), $options: 'i' } },
                { description:  { $regex: escapeRegex(search), $options: 'i' } },
            ];
        }

        if (status === 'active')   { query.isActive = true;  query.isPremium = { $ne: true }; }
        if (status === 'inactive') { query.isActive = false; }
        if (status === 'featured') { query.isPremium = true; }

        const filteredTotal = await Category.countDocuments(query);

        const categories = await Category.find(query)
            .sort({ displayOrder: 1, createdAt: -1 })
            .skip((currentPage - 1) * ITEMS_PER_PAGE)
            .limit(ITEMS_PER_PAGE)
            .lean();

        
        for (const cat of categories) {
            cat.productCount = await Product.countDocuments({ categoryId: cat._id });
        }

        res.render('admin/categories/index', {
            title: 'Category Management',
            categories,
            totalCategories,
            activeCategories,
            featuredCount,
            totalProducts,
            totalPages:  Math.ceil(filteredTotal / ITEMS_PER_PAGE),
            currentPage,
            search,
            status,
            error:   req.query.error   || null,
            success: req.query.success || null,
        });

    } catch (err) {
        console.error('getCategories error:', err.message);
        res.render('admin/categories/index', {
            title: 'Category Management',
            categories: [], totalCategories: 0, activeCategories: 0,
            featuredCount: 0, totalProducts: 0, totalPages: 1, currentPage: 1,
            search: '', status: '',
            error: 'Failed to load categories', success: null,
        });
    }
};


export const getEditCategory = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id).lean();
        if (!category) return res.redirect('/admin/categories?error=Category not found');

        res.render('admin/categories/edit', {
            title: 'Edit Category',
            category,
            error:   req.query.error   || null,
            success: req.query.success || null,
        });
    } catch (err) {
        console.error('getEditCategory error:', err.message);
        res.redirect('/admin/categories?error=Failed to load category');
    }
};

export const addCategory = async (req, res) => {
    try {
        const { categoryName, description, icon, displayOrder, status, isPremium, totalMoney, totalPercentage } = req.body;

        const exists = await Category.findOne({
            categoryName: { $regex: `^${categoryName.trim()}$`, $options: 'i' }
        });
        if (exists) return res.redirect('/admin/categories?error=Category already exists');

        await Category.create({
            categoryName:    categoryName.trim(),
            description:     description || '',
            icon:            icon || 'fa-tags',
            isActive:        status !== 'Inactive',
            isPremium:       isPremium === 'true',
            totalMoney:      parseFloat(totalMoney) || 0,
            totalPercentage: parseFloat(totalPercentage) || 0,
            displayOrder:    parseInt(displayOrder, 10) || 1,
        });

        res.redirect('/admin/categories?success=Category added successfully');
    } catch (err) {
        console.error('addCategory error:', err.message);
        res.redirect('/admin/categories?error=Failed to add category');
    }
};


export const editCategory = async (req, res) => {
    try {
        const { categoryName, description, icon, displayOrder, status, isPremium, totalMoney, totalPercentage } = req.body;
        const category = await Category.findById(req.params.id);
        if (!category) return res.redirect('/admin/categories?error=Category not found');

        category.categoryName    = categoryName.trim();
        category.description     = description || '';
        category.icon            = icon || 'fa-tags';
        category.isActive        = status !== 'Inactive';
        category.isPremium       = isPremium === 'true';
        category.totalMoney      = parseFloat(totalMoney) || 0;
        category.totalPercentage = parseFloat(totalPercentage) || 0;
        category.displayOrder    = parseInt(displayOrder, 10) || 1;

        await category.save();
        res.redirect('/admin/categories?success=Category updated successfully');
    } catch (err) {
        console.error('editCategory error:', err.message);
        res.redirect(`/admin/categories/edit/${req.params.id}?error=Failed to update category`);
    }
};

export const deleteCategory = async (req, res) => {
    try {
       
        const activeProductCount = await Product.countDocuments({ 
            categoryId: req.params.id, 
            isActive: true 
        });

        if (activeProductCount > 0) {
            return res.redirect('/admin/categories?error=Cannot+deactivate+category+with+active+products');
        }

        
        const category = await Category.findByIdAndUpdate(
            req.params.id,
            { isActive: false },
            { new: true }
        );

        if (!category) {
            return res.redirect('/admin/categories?error=Category+not+found');
        }

        res.redirect('/admin/categories?success=Category+deactivated+successfully');

    } catch (err) {
        console.error('deleteCategory error:', err.message);
        res.redirect('/admin/categories?error=Failed+to+deactivate+category');
    }
};


export const toggleCategoryStatus = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) return res.redirect('/admin/categories?error=Category not found');
        category.isActive = !category.isActive;
        await category.save();
        res.redirect('/admin/categories?success=Category status updated');
    } catch (err) {
        console.error('toggleCategoryStatus error:', err.message);
        res.redirect('/admin/categories?error=Failed to toggle status');
    }
};