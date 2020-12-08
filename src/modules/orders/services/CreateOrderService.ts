import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const costumerExists = await this.customersRepository.findById(customer_id);

    if (!costumerExists) throw new AppError('Invalid user');

    const productsExist = await this.productsRepository.findAllById(products);

    if (!productsExist.length) throw new AppError('Could not find products');

    const productsId = productsExist.map(product => product.id);

    const checkInexistingProducts = products.filter(
      product => !productsId.includes(product.id),
    );

    if (checkInexistingProducts.length)
      throw new AppError('Invalid product selected');

    const findProductsUnavailable = products.filter(
      product =>
        productsExist.filter(
          existingProduct => existingProduct.id === product.id,
        )[0].quantity < product.quantity,
    );

    if (findProductsUnavailable.length)
      throw new AppError('Quantity not available');

    const formattedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: productsExist.filter(prod => prod.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer: costumerExists,
      products: formattedProducts,
    });

    const orderedProductsQuantity = products.map(product => ({
      id: product.id,
      quantity:
        productsExist.filter(
          existingProduct => existingProduct.id === product.id,
        )[0].quantity - product.quantity,
    }));

    await this.productsRepository.updateQuantity(orderedProductsQuantity);

    return order;
  }
}

export default CreateOrderService;
